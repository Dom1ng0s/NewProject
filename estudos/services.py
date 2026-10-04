"""Calculos compartilhados entre as views."""

from datetime import date, datetime, time, timedelta

from django.db.models import Max, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from .models import (
    Avaliacao,
    Configuracao,
    BlocoPlanejado,
    Materia,
    OcorrenciaPulada,
    Revisao,
    SessaoEstudo,
    Topico,
)


def segunda_da_semana(dia=None):
    dia = dia or timezone.localdate()
    return dia - timedelta(days=dia.weekday())


def parse_semana(valor):
    """Aceita 'AAAA-MM-DD' (qualquer dia) e devolve a segunda-feira correspondente."""
    if not valor:
        return segunda_da_semana()
    try:
        return segunda_da_semana(date.fromisoformat(valor))
    except ValueError:
        return segunda_da_semana()


def intervalo_semana(semana):
    inicio = timezone.make_aware(datetime.combine(semana, time.min))
    fim = inicio + timedelta(days=7)
    return inicio, fim


def minutos_por_materia(inicio, fim):
    linhas = (
        SessaoEstudo.objects.filter(inicio__gte=inicio, inicio__lt=fim)
        .values("topico__materia_id")
        .annotate(total=Sum("duracao_min"))
    )
    return {linha["topico__materia_id"]: linha["total"] or 0 for linha in linhas}


def avaliacoes_proximas(dias=None):
    """Provas e entregas ainda em aberto, da mais proxima para a mais distante.

    Uma avaliacao cuja data ja passou continua na lista enquanto nao for
    marcada como concluida -- esquecer de fechar nao pode apaga-la da tela.
    """
    if dias is None:
        dias = Configuracao.atual().dias_proximas_avaliacoes
    limite = timezone.localdate() + timedelta(days=dias)
    avaliacoes = (
        Avaliacao.objects.filter(concluida=False, data__lte=limite)
        .select_related("materia")
        .prefetch_related("topicos")
    )
    return [a.json() for a in avaliacoes]


def dias_ate_a_prova(avaliacoes):
    """topico_id -> dias ate a avaliacao mais proxima que cobra aquele topico."""
    prazos = {}
    for avaliacao in avaliacoes:
        for topico in avaliacao["topicos"]:
            atual = prazos.get(topico["id"])
            if atual is None or avaliacao["dias"] < atual:
                prazos[topico["id"]] = avaliacao["dias"]
    return prazos


def _ordem_da_fila(item):
    """Primeiro o que cai numa prova proxima; depois o que esta ha mais tempo esperando."""
    prazo = item["prova_dias"]
    return (prazo is None, prazo if prazo is not None else 0, item["data_prevista"])


def dados_dashboard():
    config = Configuracao.atual()
    hoje = timezone.localdate()
    semana = segunda_da_semana(hoje)
    inicio, fim = intervalo_semana(semana)

    avaliacoes = avaliacoes_proximas()
    prazos = dias_ate_a_prova(avaliacoes)

    revisoes = Revisao.objects.filter(feita=False, data_prevista__lte=hoje).select_related(
        "topico__materia"
    )
    fila = []
    for revisao in revisoes:
        item = revisao.json()
        item["prova_dias"] = prazos.get(revisao.topico_id)
        fila.append(item)
    fila.sort(key=_ordem_da_fila)

    hoje_lista = [r for r in fila if r["data_prevista"] == hoje.isoformat()]
    atrasadas = [r for r in fila if r["data_prevista"] < hoje.isoformat()]

    # O teto do dia vale para o que ja venceu tambem: um acumulo de atrasadas
    # nao pode transformar hoje num dia impossivel. A fila ja vem ordenada por
    # prova mais proxima, entao o corte deixa passar o que mais urge.
    teto = config.maximo_revisoes_por_dia
    do_dia = fila[:teto] if teto else fila
    esperando = len(fila) - len(do_dia)

    minutos = SessaoEstudo.objects.filter(inicio__gte=inicio, inicio__lt=fim).aggregate(
        total=Sum("duracao_min")
    )["total"] or 0

    por_materia = []
    minutos_materia = minutos_por_materia(inicio, fim)
    ultima_sessao = {
        linha["topico__materia_id"]: linha["ultima"]
        for linha in SessaoEstudo.objects.values("topico__materia_id").annotate(
            ultima=Max("inicio")
        )
    }
    paradas = []
    for materia in Materia.objects.all():
        total = Topico.objects.filter(materia=materia).count()
        dominados = Topico.objects.filter(materia=materia, status=Topico.DOMINADO).count()
        por_materia.append(
            {
                "id": materia.id,
                "nome": materia.nome,
                "cor": materia.cor,
                "total": total,
                "dominados": dominados,
                "percentual": round(dominados * 100 / total) if total else 0,
                "horas_semana": round(minutos_materia.get(materia.id, 0) / 60, 1),
                "meta_horas_semanais": materia.meta_horas_semanais,
            }
        )
        ultima = ultima_sessao.get(materia.id)
        dias = (hoje - timezone.localtime(ultima).date()).days if ultima else None
        if dias is None or dias > config.dias_materia_parada:
            paradas.append({"nome": materia.nome, "cor": materia.cor, "dias": dias})

    return {
        "hoje": hoje.isoformat(),
        "revisoes_hoje": hoje_lista,
        "revisoes_atrasadas": atrasadas,
        "fila_do_dia": do_dia,
        "fila_esperando": esperando,
        "maximo_por_dia": teto,
        "avaliacoes": avaliacoes,
        "horas_semana": round(minutos / 60, 1),
        "meta_horas_semanais": config.meta_horas_semanais,
        "percentual_meta": min(
            round(minutos / 60 * 100 / config.meta_horas_semanais)
            if config.meta_horas_semanais
            else 0,
            100,
        ),
        "materias": por_materia,
        "materias_paradas": paradas,
    }


def blocos_da_semana(semana):
    """Blocos daquela semana mais os recorrentes, marcando os pulados."""
    fixos = BlocoPlanejado.objects.filter(semana__isnull=True).select_related(
        "materia", "topico"
    )
    pontuais = BlocoPlanejado.objects.filter(semana=semana).select_related(
        "materia", "topico"
    )
    pulados = set(
        OcorrenciaPulada.objects.filter(semana=semana).values_list("bloco_id", flat=True)
    )

    itens = [b.json(semana=semana, pulado=b.id in pulados) for b in fixos]
    itens += [b.json() for b in pontuais]
    itens.sort(key=lambda d: (d["dia_semana"], d["inicio_min"]))
    return itens


def dados_planner(semana):
    inicio, fim = intervalo_semana(semana)
    itens = blocos_da_semana(semana)
    realizado = minutos_por_materia(inicio, fim)

    # Bloco pulado nao conta como planejado; bloco sem materia (academia,
    # trabalho) ocupa a grade mas fica fora do comparativo por materia.
    planejado = {}
    for item in itens:
        if item["pulado"] or not item["materia_id"]:
            continue
        planejado[item["materia_id"]] = (
            planejado.get(item["materia_id"], 0) + item["duracao_min"]
        )

    comparativo = []
    for materia in Materia.objects.all():
        p = planejado.get(materia.id, 0)
        r = realizado.get(materia.id, 0)
        if not (p or r or materia.meta_horas_semanais):
            continue
        comparativo.append(
            {
                "materia": materia.nome,
                "cor": materia.cor,
                "planejado_h": round(p / 60, 1),
                "realizado_h": round(r / 60, 1),
                "meta_h": materia.meta_horas_semanais,
            }
        )

    ativos = [i for i in itens if not i["pulado"]]
    return {
        "semana": semana.isoformat(),
        "semana_anterior": (semana - timedelta(days=7)).isoformat(),
        "semana_seguinte": (semana + timedelta(days=7)).isoformat(),
        "e_semana_atual": semana == segunda_da_semana(),
        "blocos": itens,
        "comparativo": comparativo,
        # faixa de horas que a grade precisa cobrir
        "hora_min": min([i["inicio_min"] // 60 for i in ativos], default=7),
        "hora_max": max(
            [-(-(i["inicio_min"] + i["duracao_min"]) // 60) for i in ativos], default=23
        ),
    }


# ---------------------------------------------------------------- historico

# Quantos dias o mapa de constancia cobre. Multiplo de 7 para a grade comecar
# numa segunda e terminar no dia de hoje sem sobra.
DIAS_DO_MAPA = 182  # 26 semanas
SEMANAS_DA_TENDENCIA = 12


def minutos_por_dia(desde):
    """data -> minutos estudados naquele dia, so dos dias que tiveram sessao."""
    inicio = timezone.make_aware(datetime.combine(desde, time.min))
    linhas = (
        SessaoEstudo.objects.filter(inicio__gte=inicio)
        .annotate(dia=TruncDate("inicio"))
        .values("dia")
        .annotate(total=Sum("duracao_min"))
    )
    return {linha["dia"]: linha["total"] or 0 for linha in linhas}


def nivel_do_dia(minutos, teto):
    """0 a 4, para o mapa ter contraste sem depender de um valor absoluto.

    O teto e o melhor dia do periodo: num mes fraco o mapa continua legivel.
    """
    if not minutos:
        return 0
    if not teto:
        return 1
    return min(4, 1 + int(minutos * 3 / teto))


def sequencia(dias_estudados, hoje):
    """(sequência atual, maior sequência) em dias seguidos com sessao.

    A sequencia atual aceita terminar ontem: o dia de hoje ainda nao acabou, e
    zerar a contagem as 00h01 so puniria quem estuda de manha.
    """
    if not dias_estudados:
        return 0, 0

    ordenados = sorted(dias_estudados)
    maior = atual_corrida = 1
    for anterior, seguinte in zip(ordenados, ordenados[1:]):
        if (seguinte - anterior).days == 1:
            atual_corrida += 1
            maior = max(maior, atual_corrida)
        else:
            atual_corrida = 1

    ultimo = ordenados[-1]
    if (hoje - ultimo).days > 1:
        return 0, maior
    return atual_corrida, maior


def dados_historico(dias=DIAS_DO_MAPA):
    hoje = timezone.localdate()
    # A grade comeca numa segunda para as colunas baterem com as semanas.
    primeiro = segunda_da_semana(hoje - timedelta(days=dias - 1))
    por_dia = minutos_por_dia(primeiro)
    teto = max(por_dia.values(), default=0)

    mapa = []
    dia = primeiro
    while dia <= hoje:
        minutos = por_dia.get(dia, 0)
        mapa.append(
            {
                "data": dia.isoformat(),
                "dia_semana": dia.weekday(),
                "minutos": minutos,
                "nivel": nivel_do_dia(minutos, teto),
            }
        )
        dia += timedelta(days=1)

    atual, maior = sequencia(set(por_dia), hoje)

    # Tendencia: horas estudadas e revisoes fechadas, semana a semana.
    semanas = []
    comeco = segunda_da_semana(hoje) - timedelta(weeks=SEMANAS_DA_TENDENCIA - 1)
    for i in range(SEMANAS_DA_TENDENCIA):
        semana = comeco + timedelta(weeks=i)
        minutos = sum(
            por_dia.get(semana + timedelta(days=d), 0) for d in range(7)
        )
        semanas.append(
            {
                "semana": semana.isoformat(),
                "horas": round(minutos / 60, 1),
                "minutos": minutos,
                "revisoes": Revisao.objects.filter(
                    feita=True,
                    feita_em__gte=timezone.make_aware(datetime.combine(semana, time.min)),
                    feita_em__lt=timezone.make_aware(
                        datetime.combine(semana + timedelta(days=7), time.min)
                    ),
                ).count(),
            }
        )

    inicio = timezone.make_aware(datetime.combine(primeiro, time.min))
    topicos = [
        {
            "topico": linha["topico__nome"],
            "materia": linha["topico__materia__nome"],
            "cor": linha["topico__materia__cor"],
            "horas": round((linha["total"] or 0) / 60, 1),
        }
        for linha in (
            SessaoEstudo.objects.filter(inicio__gte=inicio)
            .values("topico__nome", "topico__materia__nome", "topico__materia__cor")
            .annotate(total=Sum("duracao_min"))
            .order_by("-total")[:10]
        )
    ]

    total_minutos = sum(por_dia.values())
    dias_ativos = len(por_dia)
    return {
        "hoje": hoje.isoformat(),
        "desde": primeiro.isoformat(),
        "mapa": mapa,
        "sequencia_atual": atual,
        "maior_sequencia": maior,
        "dias_ativos": dias_ativos,
        "dias_no_periodo": len(mapa),
        "total_horas": round(total_minutos / 60, 1),
        "media_por_dia_ativo": round(total_minutos / dias_ativos / 60, 1) if dias_ativos else 0,
        "semanas": semanas,
        "topicos": topicos,
    }
