"""Calculos compartilhados entre as views."""

from datetime import date, datetime, time, timedelta

from django.db import transaction
from django.db.models import Avg, Count, Max, Min, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from .escopo import atual_id
from .models import (
    Avaliacao,
    Cartao,
    Configuracao,
    BlocoPlanejado,
    Marco,
    Materia,
    OcorrenciaPulada,
    RespostaRevisao,
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


def revisoes_feitas_hoje(hoje=None):
    hoje = hoje or timezone.localdate()
    comeco = timezone.make_aware(datetime.combine(hoje, time.min))
    return Revisao.objects.filter(
        feita=True, feita_em__gte=comeco, feita_em__lt=comeco + timedelta(days=1)
    ).count()


def revisoes_que_ainda_cabem_hoje(hoje=None, config=None):
    """Quantas revisoes ainda cabem hoje, descontando as que ja foram feitas.

    O que ja foi respondido hoje conta contra o teto -- senao o teto nao e um
    teto do dia, e so um limite de quantas linhas a lista mostra de cada vez: a
    cada resposta outra subiria do atraso e a tarefa nunca encolheria. E uma
    tarefa que nao encolhe ninguem termina.

    `None` quando nao ha teto: a fila inteira e o dia.
    """
    config = config or Configuracao.atual()
    if not config.maximo_revisoes_por_dia:
        return None
    return max(config.maximo_revisoes_por_dia - revisoes_feitas_hoje(hoje), 0)


def restantes_do_dia(hoje=None, config=None):
    """Quantas revisoes ainda contam para hoje, ja cortadas no teto do dia."""
    hoje = hoje or timezone.localdate()
    pendentes = Revisao.objects.filter(feita=False, data_prevista__lte=hoje).count()
    vagas = revisoes_que_ainda_cabem_hoje(hoje, config)
    return pendentes if vagas is None else min(pendentes, vagas)


def progresso_do_dia(restantes, hoje=None):
    """Quanto da fila de hoje ja foi fechado, numa conta que chega a 100%.

    A divida -- o que passou do teto e volta amanha -- fica de fora de
    proposito. Um contador que nunca zera nao e progresso, e cobranca: a fila
    que da para terminar e a que se termina, e a que mostra 23 pendentes todo
    dia e a que se abandona. O excedente continua existindo em
    `fila_esperando`, so nao disputa a manchete com ela.
    """
    feitas = revisoes_feitas_hoje(hoje)
    total = feitas + restantes
    return {
        "feitas": feitas,
        "restantes": restantes,
        "total": total,
        # Sem nada marcado o dia ja esta cumprido; 0% seria mentira.
        "percentual": round(feitas * 100 / total) if total else 100,
        "zerada": restantes == 0,
        "fechou_agora": restantes == 0 and feitas > 0,
    }


def folgas_restantes(dias_estudados, hoje, folgas):
    """Quantos dias a sequencia ainda perdoa nesta janela de sete.

    Hoje nao entra na conta: o dia nao acabou, e contar como perdido um dia que
    ainda da para salvar e justamente o aviso que faz desistir dele.
    """
    perdidos = sum(
        1
        for i in range(1, JANELA_DA_FOLGA)
        if (hoje - timedelta(days=i)) not in dias_estudados
    )
    return max(folgas - perdidos, 0)


def resumo_da_sequencia(hoje=None, config=None):
    """Dias seguidos, semanas na meta e o que a sequencia ainda perdoa."""
    hoje = hoje or timezone.localdate()
    config = config or Configuracao.atual()
    por_dia = minutos_por_dia(hoje - timedelta(days=DIAS_DO_MAPA - 1))
    estudados = set(por_dia)

    dias, maior_dias = sequencia(estudados, hoje, config.folgas_por_semana)
    semanas, maior_semanas = semanas_na_meta(por_dia, hoje, config.meta_horas_semanais)
    return {
        "dias": dias,
        "maior_dias": maior_dias,
        "semanas": semanas,
        "maior_semanas": maior_semanas,
        "folgas": config.folgas_por_semana,
        "folgas_restantes": folgas_restantes(estudados, hoje, config.folgas_por_semana),
        "estudou_hoje": hoje in estudados,
        # Ha uma corrida em pe e o dia ainda nao foi cumprido. Nao e culpa: e o
        # que esta em jogo, e dizer o que esta em jogo e o que faz comecar.
        # Sequencia zerada nao entra aqui -- quem nao tem corrida nao tem o que
        # perder, e cobrar dessa pessoa e cobrar do dia em que ela voltou.
        "em_risco": bool(dias) and hoje not in estudados,
    }


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
    #
    # O corte desconta o que ja foi respondido hoje: sem isso, cada resposta
    # puxaria outra do atraso para o lugar dela e a tarefa do dia nunca
    # encolheria -- a fila ficaria sempre em dez, qualquer que fosse o esforco.
    teto = config.maximo_revisoes_por_dia
    vagas = revisoes_que_ainda_cabem_hoje(hoje, config)
    do_dia = fila if vagas is None else fila[:vagas]
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
        "continuar": continuar_de_onde_parou(),
        "progresso": progresso_do_dia(len(do_dia), hoje),
        # A sequencia mora no historico, mas e no dashboard que ela sustenta o
        # habito: saber que ha uma corrida em pe e o que faz abrir amanha.
        "sequencia": resumo_da_sequencia(hoje, config),
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


# Janela da folga. Uma semana e o periodo em que "um dia perdido" ainda e um
# acidente: dois dias perdidos em sete viraram outro habito, nao um tropeco.
JANELA_DA_FOLGA = 7


def sequencia(dias_estudados, hoje, folgas=None):
    """(sequência atual, maior sequência) em dias seguidos com sessao.

    A sequencia atual aceita terminar ontem: o dia de hoje ainda nao acabou, e
    zerar a contagem as 00h01 so puniria quem estuda de manha.

    Um dia perdido tambem nao zera tudo. `folgas` e quantos dias a sequencia
    perdoa dentro de qualquer janela de sete -- uma semana de prova derruba o
    dia de estudo, e uma sequencia que morre por isso e uma sequencia que
    ninguem recomeca. Perdoar e o que mantem a conta util: o que ela deve medir
    e o habito, nao a sorte do calendario.

    A mesma regra vale para a maior sequencia: duas contas com dois criterios
    seriam dois numeros que nunca se explicam um ao outro.
    """
    if folgas is None:
        folgas = Configuracao.atual().folgas_por_semana
    if not dias_estudados:
        return 0, 0

    def cabe(perdidos, usadas, ate):
        """Os dias perdidos ainda cabem nas folgas da janela que termina em `ate`?"""
        recentes = [d for d in usadas if (ate - d).days < JANELA_DA_FOLGA]
        return len(recentes) + len(perdidos) <= folgas

    def buraco(anterior, seguinte):
        """Os dias sem estudo entre dois dias estudados."""
        return [
            anterior + timedelta(days=i + 1)
            for i in range((seguinte - anterior).days - 1)
        ]

    ordenados = sorted(dias_estudados)
    maior = corrida = 1
    usadas = []  # dias ja perdoados dentro da corrida em andamento
    for anterior, seguinte in zip(ordenados, ordenados[1:]):
        perdidos = buraco(anterior, seguinte)
        if not perdidos:
            corrida += 1
        elif cabe(perdidos, usadas, seguinte):
            usadas = [
                d for d in usadas if (seguinte - d).days < JANELA_DA_FOLGA
            ] + perdidos
            corrida += 1
        else:
            corrida = 1
            usadas = []
        maior = max(maior, corrida)

    # O fim da corrida tem a mesma regra do meio dela: ontem conta porque hoje
    # ainda nao acabou, e um buraco antes disso pode caber numa folga.
    perdidos = buraco(ordenados[-1], hoje)
    if not perdidos or cabe(perdidos, usadas, hoje):
        return corrida, maior
    return 0, maior


def semanas_na_meta(por_dia, hoje, meta):
    """(semanas seguidas batendo a meta, maior sequência de semanas).

    A manchete do historico e esta, nao a sequencia de dias: numa grade de
    faculdade o dia certo escorrega -- a prova rouba a terca e devolve o sabado
    -- e a semana e a menor unidade em que isso se compensa. Dias seguidos
    quebram na semana de prova de quem estudou mais, nao menos.

    A semana corrente nao quebra a conta enquanto nao acaba: ela entra quando
    bate a meta, e antes disso so nao conta.
    """
    if not meta:
        return 0, 0

    totais = {}
    for dia, minutos in por_dia.items():
        semana = segunda_da_semana(dia)
        totais[semana] = totais.get(semana, 0) + minutos

    def bateu(semana):
        return totais.get(semana, 0) / 60 >= meta

    atual = segunda_da_semana(hoje)
    corrida = 0
    semana = atual if bateu(atual) else atual - timedelta(weeks=1)
    while bateu(semana):
        corrida += 1
        semana -= timedelta(weeks=1)

    maior = seguidas = 0
    if totais:
        semana = min(totais)
        while semana <= atual:
            seguidas = seguidas + 1 if bateu(semana) else 0
            maior = max(maior, seguidas)
            semana += timedelta(weeks=1)

    return corrida, max(maior, corrida)


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

    config = Configuracao.atual()
    atual, maior = sequencia(set(por_dia), hoje, config.folgas_por_semana)
    semanas_seguidas, maior_semanas = semanas_na_meta(
        por_dia, hoje, config.meta_horas_semanais
    )

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
        # A manchete da tela: a semana aguenta a grade da faculdade, o dia nao.
        "semanas_na_meta": semanas_seguidas,
        "maior_semanas_na_meta": maior_semanas,
        "meta_horas_semanais": config.meta_horas_semanais,
        "folgas_por_semana": config.folgas_por_semana,
        "folgas_restantes": folgas_restantes(
            set(por_dia), hoje, config.folgas_por_semana
        ),
        "dias_ativos": dias_ativos,
        "dias_no_periodo": len(mapa),
        "total_horas": round(total_minutos / 60, 1),
        "media_por_dia_ativo": round(total_minutos / dias_ativos / 60, 1) if dias_ativos else 0,
        "semanas": semanas,
        "topicos": topicos,
        "frageis": topicos_frageis(),
        "interrupcoes_e_erro": interrupcoes_e_erro(),
    }


# ---------------------------------------------------------------- continuar


# Piso do foco sugerido. Um bloco que esta acabando ainda rende um pomodoro
# curto; sugerir "1 minuto" seria o mesmo que nao sugerir nada.
MINIMO_DE_FOCO_MIN = 5


def bloco_de_agora(agora=None):
    """O bloco do planner que cobre este instante, ou None.

    Olha so os blocos com topico: um compromisso sem topico (academia, aula
    sem conteudo marcado) ocupa a grade mas nao diz o que estudar.
    """
    agora = agora or timezone.localtime()
    minuto = agora.hour * 60 + agora.minute
    for item in blocos_da_semana(segunda_da_semana(agora.date())):
        if item["pulado"] or not item["topico_id"]:
            continue
        if item["dia_semana"] != agora.weekday():
            continue
        if item["inicio_min"] <= minuto < item["inicio_min"] + item["duracao_min"]:
            return item, item["inicio_min"] + item["duracao_min"] - minuto
    return None, 0


def continuar_de_onde_parou(agora=None):
    """O topico que o dashboard oferece em um clique, com o motivo da escolha.

    Primeiro o bloco do planner que cobre a hora atual -- se a agenda diz o que
    e agora, ela ganha. Sem bloco, o topico da ultima sessao: na pratica, e o
    que voce estava estudando. Sem nenhuma sessao, nao ha o que continuar.
    """
    config = Configuracao.atual()
    bloco, restante = bloco_de_agora(agora)
    if bloco:
        return {
            "topico_id": bloco["topico_id"],
            "topico": bloco["topico"],
            "materia": bloco["materia"] or "",
            "cor": bloco["cor"],
            "minutos": max(restante, MINIMO_DE_FOCO_MIN),
            "motivo": f"agora no planner, até {bloco['hora_fim']}",
        }

    ultima = (
        SessaoEstudo.objects.select_related("topico__materia").order_by("-inicio").first()
    )
    if not ultima:
        return None
    return {
        "topico_id": ultima.topico_id,
        "topico": ultima.topico.nome,
        "materia": ultima.topico.materia.nome,
        "cor": ultima.topico.materia.cor,
        "minutos": config.pomodoro_foco_min,
        "motivo": "o que você estudou por último",
    }


# ---------------------------------------------------------------- respostas


@transaction.atomic
def registrar_resposta(revisao, qualidade):
    """Fecha a revisao, aplica o SM-2 e guarda a resposta no log.

    Tudo o que uma resposta muda passa por aqui, numa transacao: a revisao, o
    status do topico, o estado do SM-2 e a linha do log. Isso e o que permite
    desfazer -- a linha do log sabe de onde o topico veio.
    """
    topico = revisao.topico
    antes = {
        "status": topico.status,
        "facilidade": topico.facilidade,
        "intervalo_dias": topico.intervalo_dias,
        "acertos_seguidos": topico.acertos_seguidos,
    }

    agora = timezone.now()
    revisao.feita = True
    revisao.dificil = qualidade < 4
    revisao.qualidade = qualidade
    revisao.feita_em = agora
    revisao.save()

    # Acertar promove o topico; errar devolve para "estudando".
    if qualidade < 3:
        if topico.status in (Topico.REVISADO, Topico.DOMINADO):
            topico.status = Topico.ESTUDANDO
            topico.save(update_fields=["status"])
    elif topico.status in (Topico.NAO_INICIADO, Topico.ESTUDANDO):
        topico.status = Topico.REVISADO
        topico.save(update_fields=["status"])

    nova = topico.responder(qualidade)

    resposta = RespostaRevisao.objects.create(
        topico=topico,
        revisao=revisao,
        qualidade=qualidade,
        respondida_em=agora,
        data_prevista=revisao.data_prevista,
        atraso_dias=max((timezone.localdate(agora) - revisao.data_prevista).days, 0),
        status_antes=antes["status"],
        facilidade_antes=antes["facilidade"],
        intervalo_antes=antes["intervalo_dias"],
        acertos_antes=antes["acertos_seguidos"],
        facilidade_depois=topico.facilidade,
        intervalo_depois=topico.intervalo_dias,
    )
    return resposta, nova


# Passos que a escadinha de um topico mostra. Oito cabem num tracinho de 54px
# e ja dizem a forma: subindo, travada no primeiro degrau, ou serrote.
PASSOS_DA_ESCADA = 8


def escada_dos_topicos(quantos=PASSOS_DA_ESCADA):
    """topico_id -> os ultimos intervalos que o SM-2 deu, do antigo ao novo.

    A recompensa da revisao nao e um ponto nem um medalha: e ver o intervalo
    subir. Um topico que foi de 1 para 6 para 15 dias esta sendo aprendido, e um
    que bate em 1 toda vez esta pedindo um cartao melhor -- as duas coisas se
    leem de relance num tracinho, e nenhuma se le numa tabela de facilidade.

    Uma consulta so, todas as respostas: num app de uma pessoa o log e pequeno,
    e uma consulta por topico seria uma dezena delas para desenhar uma tela.
    """
    escada = {}
    for topico_id, intervalo in RespostaRevisao.objects.order_by(
        "-respondida_em", "-id"
    ).values_list("topico_id", "intervalo_depois"):
        passos = escada.setdefault(topico_id, [])
        if len(passos) < quantos:
            passos.append(intervalo)
    return {topico_id: passos[::-1] for topico_id, passos in escada.items()}


def cartao_surpresa():
    """Um cartao ao acaso de um topico ja dominado, sem nota e sem SM-2.

    E a porta de entrada mais barata do app: custa um clique, a resposta quase
    sempre vem -- e por isso so pesca em topico dominado (ou revisado, se nenhum
    estiver) -- e quem abre por curiosidade com frequencia fica para a sessao.
    Nao e revisao: nao fecha fila, nao da nota, nao mexe em intervalo nenhum.
    Variar o conteudo, nao a recompensa: o acaso aqui escolhe qual cartao
    aparece, nunca quanto ele vale.
    """
    for status in (Topico.DOMINADO, Topico.REVISADO):
        cartao = (
            Cartao.objects.filter(topico__status=status)
            .select_related("topico__materia")
            .order_by("?")
            .first()
        )
        if cartao:
            return {
                "cartao": cartao.json(),
                "topico_id": cartao.topico_id,
                "topico": cartao.topico.nome,
                "materia": cartao.topico.materia.nome,
                "cor": cartao.topico.materia.cor,
                "status": cartao.topico.status,
                "minutos": Configuracao.atual().pomodoro_foco_min,
            }
    return None


class NadaParaDesfazer(Exception):
    """Nao existe resposta recente para devolver."""


@transaction.atomic
def desfazer_ultima_resposta():
    """Devolve o topico ao estado de antes da ultima nota dada.

    Apertar 1 em vez de 3 derrubava a escada do topico sem volta: a facilidade
    caia, o intervalo voltava ao primeiro degrau e a proxima revisao ja estava
    marcada. O log sabe de onde o topico veio, entao desfazer e so recolocar.

    So a resposta mais recente pode ser desfeita, e desfazer de novo desfaz a
    anterior -- a pilha tem a profundidade do log.
    """
    log = RespostaRevisao.objects.select_related("topico", "revisao").first()
    if log is None:
        raise NadaParaDesfazer("Nenhuma resposta para desfazer.")

    topico = log.topico
    topico.status = log.status_antes
    topico.facilidade = log.facilidade_antes
    topico.intervalo_dias = log.intervalo_antes
    topico.acertos_seguidos = log.acertos_antes
    topico.save(
        update_fields=["status", "facilidade", "intervalo_dias", "acertos_seguidos"]
    )

    # A resposta agendou a proxima revisao; ela nao deveria existir.
    pendentes = Revisao.objects.filter(topico=topico, feita=False)
    if log.revisao_id:
        pendentes = pendentes.exclude(pk=log.revisao_id)
    pendentes.delete()

    # E a revisao que foi fechada volta para a fila, no dia em que estava.
    revisao = log.revisao
    if revisao:
        revisao.feita = False
        revisao.dificil = False
        revisao.qualidade = None
        revisao.feita_em = None
        revisao.save()
    else:
        # Revisao apagada depois da resposta: a fila recebe uma no lugar dela,
        # senao o topico sai da escada sem ninguem pedir.
        revisao = Revisao.objects.create(
            topico=topico, data_prevista=log.data_prevista, feita=False
        )

    dados = {
        "topico_id": topico.id,
        "topico": topico.nome,
        "materia": topico.materia.nome,
        "qualidade": log.qualidade,
        "revisao_id": revisao.id,
    }
    log.delete()
    return dados


def ultima_resposta():
    """A resposta que o botao "Desfazer" devolveria, ou None."""
    log = RespostaRevisao.objects.select_related("topico__materia").first()
    return log.json() if log else None


# ---------------------------------------------------------------- carga futura

# Horizonte do grafico de carga. Quatro semanas e o que cabe na tela sem virar
# uma regua ilegivel, e e tambem o horizonte em que uma prova ja importa.
DIAS_DA_CARGA = 28

# Janela que o alerta de colisao olha antes de uma prova. Uma semana e o tempo
# que sobra para revisar de verdade o que cai nela.
DIAS_ANTES_DA_PROVA = 7


def revisoes_por_dia_previstas(de, ate):
    """data -> quantas revisoes pendentes estao marcadas para aquele dia.

    O que venceu e nao foi feito conta no primeiro dia da faixa: atrasada nao
    desaparece do planejamento, ela pesa hoje.
    """
    linhas = (
        Revisao.objects.filter(feita=False, data_prevista__lte=ate)
        .values("data_prevista")
        .annotate(total=Count("id"))
    )
    por_dia = {}
    for linha in linhas:
        dia = max(linha["data_prevista"], de)
        por_dia[dia] = por_dia.get(dia, 0) + linha["total"]
    return por_dia


def carga_futura(dias=DIAS_DA_CARGA):
    """O que está marcado para os próximos dias, com as provas por cima.

    O SM-2 cria divida invisivel: cada "bom" de hoje e uma revisao marcada para
    um dia que ainda nao existe na tela. Olhar so para tras (o historico) mostra
    o que foi feito; isto mostra o que vem, e e o que da para decidir.
    """
    config = Configuracao.atual()
    hoje = timezone.localdate()
    fim = hoje + timedelta(days=dias - 1)
    teto = config.maximo_revisoes_por_dia

    por_dia = revisoes_por_dia_previstas(hoje, fim)

    provas = {}
    for avaliacao in avaliacoes_proximas(dias=dias):
        if avaliacao["passou"]:
            continue
        provas.setdefault(date.fromisoformat(avaliacao["data"]), []).append(avaliacao)

    grade = []
    for i in range(dias):
        dia = hoje + timedelta(days=i)
        quantas = por_dia.get(dia, 0)
        grade.append(
            {
                "data": dia.isoformat(),
                "dia_semana": dia.weekday(),
                "revisoes": quantas,
                "cheio": bool(teto) and quantas >= teto,
                "provas": [a["titulo"] for a in provas.get(dia, [])],
            }
        )

    pico = max((d["revisoes"] for d in grade), default=0)
    return {
        "hoje": hoje.isoformat(),
        "dias": grade,
        "teto": teto,
        "total": sum(d["revisoes"] for d in grade),
        "pico": pico,
        "alertas": alertas_de_colisao(por_dia, provas, teto),
    }


def alertas_de_colisao(por_dia, provas, teto):
    """Provas cuja semana anterior nao caberia na agenda de revisoes.

    Dezenas de revisoes na semana da prova de Fisica nao e um detalhe: ou se
    antecipa parte agora, ou o dia da prova chega com a fila estourada e a
    escada de todos os topicos cai junto.
    """
    alertas = []
    for data, lista in sorted(provas.items()):
        inicio = data - timedelta(days=DIAS_ANTES_DA_PROVA - 1)
        total = sum(
            quantas for dia, quantas in por_dia.items() if inicio <= dia <= data
        )
        capacidade = teto * DIAS_ANTES_DA_PROVA if teto else 0
        if not capacidade or total <= capacidade:
            continue
        for avaliacao in lista:
            alertas.append(
                {
                    "titulo": avaliacao["titulo"],
                    "materia": avaliacao["materia"],
                    "cor": avaliacao["cor"],
                    "data": avaliacao["data"],
                    "dias": avaliacao["dias"],
                    "revisoes_na_semana": total,
                    "capacidade": capacidade,
                    "excedente": total - capacidade,
                }
            )
    return alertas


# ---------------------------------------------------------------- fragilidade

# Periodo que a conta olha. Um erro de marco nao diz nada sobre como o topico
# esta hoje; tres meses e tempo de a escada subir ou cair de verdade.
DIAS_DA_FRAGILIDADE = 90

# Abaixo de duas respostas nao ha padrao nenhum: errar uma vez e um dia ruim.
MINIMO_DE_RESPOSTAS = 2

QUANTOS_FRAGEIS = 8


def pontos_de_fragilidade(erros, facilidade):
    """Quao frageis sao os erros deste topico, numa conta que da para explicar.

    Cada erro vale um ponto; a facilidade que o SM-2 derrubou vale dois pontos
    por unidade abaixo do inicio (2.5). Um topico com dois erros e facilidade
    1.9 soma 2 + 1.2 = 3.2 -- e fica na frente de um com dois erros e facilidade
    intacta, que provavelmente so teve um mes ruim.
    """
    return round(erros + max(2.5 - facilidade, 0) * 2, 2)


def topicos_frageis(quantos=QUANTOS_FRAGEIS, dias=DIAS_DA_FRAGILIDADE):
    """Os topicos que voce acha que sabe e nao sabe.

    Sai do log de respostas: o estado atual do topico diz onde a escada esta,
    nao quantas vezes ela caiu. Topico sem erro nenhum nao entra -- a lista e
    para decidir onde gastar a proxima hora, nao para listar o que existe.
    """
    desde = timezone.now() - timedelta(days=dias)
    por_topico = {}
    for resposta in RespostaRevisao.objects.filter(
        respondida_em__gte=desde
    ).select_related("topico__materia"):
        dados = por_topico.setdefault(
            resposta.topico_id,
            {"topico": resposta.topico, "respostas": 0, "erros": 0, "ultima": None},
        )
        dados["respostas"] += 1
        if not resposta.acertou:
            dados["erros"] += 1
        if dados["ultima"] is None:
            dados["ultima"] = resposta.qualidade

    interrupcoes = interrupcoes_por_topico(desde)

    lista = []
    for dados in por_topico.values():
        if dados["respostas"] < MINIMO_DE_RESPOSTAS or not dados["erros"]:
            continue
        topico = dados["topico"]
        lista.append(
            {
                "topico_id": topico.id,
                "topico": topico.nome,
                "materia": topico.materia.nome,
                "cor": topico.materia.cor,
                "respostas": dados["respostas"],
                "erros": dados["erros"],
                "taxa_erro": round(dados["erros"] * 100 / dados["respostas"]),
                "facilidade": round(topico.facilidade, 2),
                "ultima_nota": dados["ultima"],
                "interrupcoes_media": interrupcoes.get(topico.id, {}).get("media", 0),
                "pontos": pontos_de_fragilidade(dados["erros"], topico.facilidade),
            }
        )

    lista.sort(key=lambda d: (-d["pontos"], -d["taxa_erro"], d["topico"]))
    return lista[:quantos]


def interrupcoes_por_topico(desde):
    """topico_id -> interrupcoes por sessao e quantas sessoes, desde `desde`."""
    linhas = (
        SessaoEstudo.objects.filter(inicio__gte=desde)
        .values("topico_id")
        .annotate(sessoes=Count("id"), total=Sum("interrupcoes"))
    )
    return {
        linha["topico_id"]: {
            "sessoes": linha["sessoes"],
            "media": round((linha["total"] or 0) / linha["sessoes"], 1),
        }
        for linha in linhas
    }


def interrupcoes_e_erro(dias=DIAS_DA_FRAGILIDADE):
    """Quem erra mais estuda mais picado? A pergunta que so este app responde.

    Compara a media de interrupcoes das sessoes dos topicos que erraram alguma
    revisao no periodo com a dos que nao erraram. Nao prova causa nenhuma -- mas
    e a unica ferramenta que tem os dois numeros na mesma base.
    """
    desde = timezone.now() - timedelta(days=dias)
    erraram = set(
        RespostaRevisao.objects.filter(respondida_em__gte=desde, qualidade__lt=3)
        .values_list("topico_id", flat=True)
    )
    responderam = set(
        RespostaRevisao.objects.filter(respondida_em__gte=desde).values_list(
            "topico_id", flat=True
        )
    )
    interrupcoes = interrupcoes_por_topico(desde)

    def media(ids):
        sessoes = sum(interrupcoes[i]["sessoes"] for i in ids if i in interrupcoes)
        if not sessoes:
            return None
        total = sum(
            interrupcoes[i]["media"] * interrupcoes[i]["sessoes"]
            for i in ids
            if i in interrupcoes
        )
        return round(total / sessoes, 1)

    return {
        "com_erro": media(erraram),
        "sem_erro": media(responderam - erraram),
        "topicos_com_erro": len(erraram),
        "topicos_sem_erro": len(responderam - erraram),
    }


# ---------------------------------------------------------------- plano de ataque

# Faixa do dia em que o plano pode marcar estudo. Fora dela nao e agenda, e
# insonia -- e um plano que ninguem cumpre e pior que nenhum plano.
HORA_INICIAL_DO_PLANO = 8
HORA_FINAL_DO_PLANO = 22

# Pedaco minimo que vale marcar e tamanho padrao de um bloco de revisao.
MINIMO_DO_BLOCO_MIN = 30
BLOCO_DO_PLANO_MIN = 60

# Teto por dia, para o plano nao transformar sabado inteiro em maratona.
MAXIMO_POR_DIA_MIN = 180


def vagas_do_dia(dia, blocos_da_grade):
    """Os buracos livres daquele dia, dentro da faixa do plano.

    O que ja esta na grade (aula, trabalho, academia) e intocavel: o plano so
    ocupa o que sobra, senao ele marca estudo por cima da aula.
    """
    ocupados = sorted(
        (b["inicio_min"], b["inicio_min"] + b["duracao_min"])
        for b in blocos_da_grade
        if not b["pulado"] and b["dia_semana"] == dia.weekday()
    )

    vagas = []
    cursor = HORA_INICIAL_DO_PLANO * 60
    fim_do_dia = HORA_FINAL_DO_PLANO * 60
    for inicio, fim in ocupados + [(fim_do_dia, fim_do_dia)]:
        if inicio > cursor:
            livre = min(inicio, fim_do_dia) - cursor
            if livre >= MINIMO_DO_BLOCO_MIN:
                vagas.append((cursor, min(inicio, fim_do_dia)))
        cursor = max(cursor, fim)
        if cursor >= fim_do_dia:
            break
    return vagas


def estudo_ja_marcado(dia, blocos_da_grade):
    """Minutos de estudo que aquele dia ja tem na grade.

    Conta para o teto do dia: rodar o plano duas vezes, ou ter marcado estudo a
    mao, nao pode virar uma segunda jornada por cima da primeira.
    """
    return sum(
        b["duracao_min"]
        for b in blocos_da_grade
        if not b["pulado"]
        and b["dia_semana"] == dia.weekday()
        and b["tipo"] == BlocoPlanejado.ESTUDO
    )


def ordem_de_ataque(topicos):
    """O que estudar primeiro: o que mais erra, depois o que a escada derrubou.

    Topico nunca revisado vem antes de topico dominado -- nao ha o que confirmar
    em quem nunca foi cobrado.
    """
    erros = {}
    for linha in (
        RespostaRevisao.objects.filter(topico__in=topicos, qualidade__lt=3)
        .values("topico_id")
        .annotate(total=Count("id"))
    ):
        erros[linha["topico_id"]] = linha["total"]

    return sorted(
        topicos,
        key=lambda t: (
            -erros.get(t.id, 0),
            t.status == Topico.DOMINADO,
            t.facilidade,
            t.nome,
        ),
    )


def minutos_para_hora(minutos):
    return time(minutos // 60, minutos % 60)


def plano_de_ataque(avaliacao, hoje=None):
    """Distribui o conteudo da avaliacao nos horarios livres ate a vespera.

    E o unico lugar do app em que as quatro pontas se encontram: o conteudo que
    cai, a data da prova, a ordem que o log de respostas sugere e os buracos que
    a sua semana realmente tem. Nenhuma ferramenta de fora sabe as quatro.

    Devolve a lista de blocos propostos e o que ficou de fora.
    """
    hoje = hoje or timezone.localdate()
    topicos = list(avaliacao.topicos.all())
    if not topicos:
        raise ValueError("Marque o conteúdo que cai na avaliação antes de montar o plano.")

    # Estudar na véspera ainda e estudar; no dia da prova, ja e tarde para
    # planejar -- o que fosse caber ali nao passa por um plano.
    dias = [hoje + timedelta(days=i) for i in range((avaliacao.data - hoje).days)]
    if not dias:
        raise ValueError("A prova é hoje ou já passou: não há o que planejar.")

    fila = ordem_de_ataque(topicos)
    grades = {}
    itens = []
    proximo = 0

    for dia in dias:
        semana = segunda_da_semana(dia)
        if semana not in grades:
            grades[semana] = blocos_da_semana(semana)

        usados = estudo_ja_marcado(dia, grades[semana])
        for inicio, fim in vagas_do_dia(dia, grades[semana]):
            if usados >= MAXIMO_POR_DIA_MIN:
                break
            while inicio + MINIMO_DO_BLOCO_MIN <= fim and usados < MAXIMO_POR_DIA_MIN:
                duracao = min(BLOCO_DO_PLANO_MIN, fim - inicio, MAXIMO_POR_DIA_MIN - usados)
                if duracao < MINIMO_DO_BLOCO_MIN:
                    break
                topico = fila[proximo % len(fila)]
                proximo += 1
                itens.append(
                    {
                        "data": dia.isoformat(),
                        "semana": semana.isoformat(),
                        "dia_semana": dia.weekday(),
                        "hora_inicio": minutos_para_hora(inicio).strftime("%H:%M"),
                        "hora_fim": minutos_para_hora(inicio + duracao).strftime("%H:%M"),
                        "minutos": duracao,
                        "topico_id": topico.id,
                        "topico": topico.nome,
                        "titulo": f"Revisar {topico.nome}",
                    }
                )
                inicio += duracao
                usados += duracao
            if usados >= MAXIMO_POR_DIA_MIN:
                break

    cobertos = {i["topico_id"] for i in itens}
    return {
        "avaliacao": avaliacao.titulo,
        "materia": avaliacao.materia.nome,
        "data": avaliacao.data.isoformat(),
        "dias": len(dias),
        "blocos": itens,
        "minutos": sum(i["minutos"] for i in itens),
        "topicos": len(fila),
        # Conteudo que nao coube em nenhum buraco ate a vespera: dizer isso e
        # mais util do que fingir que o plano cobre tudo.
        "de_fora": [t.nome for t in fila if t.id not in cobertos],
    }


@transaction.atomic
def gravar_plano(avaliacao, plano):
    """Escreve os blocos do plano no planner, sem repetir o que ja esta la."""
    criados = 0
    existentes = 0
    for item in plano["blocos"]:
        chave = {
            "titulo": item["titulo"],
            "semana": date.fromisoformat(item["semana"]),
            "dia_semana": item["dia_semana"],
            "hora_inicio": time.fromisoformat(item["hora_inicio"]),
            "hora_fim": time.fromisoformat(item["hora_fim"]),
        }
        if BlocoPlanejado.objects.filter(**chave).exists():
            existentes += 1
            continue
        BlocoPlanejado.objects.create(
            tipo=BlocoPlanejado.ESTUDO,
            materia=avaliacao.materia,
            topico_id=item["topico_id"],
            descricao=f"Plano de ataque: {avaliacao.titulo}",
            **chave,
        )
        criados += 1
    return {"criados": criados, "existentes": existentes}


# ---------------------------------------------------------------- investimento


def investimento():
    """O total acumulado desde o primeiro dia, sem recorte de periodo.

    O resto do app olha para a semana ou para os ultimos 180 dias, e por isso
    nenhuma tela mostra o tamanho do que ja foi feito. Este numero nao serve
    para decidir nada hoje -- serve para a conta existir: quanto maior ele
    fica, mais caro fica abandonar. E o unico lugar do app onde o passado
    inteiro aparece de uma vez, e ele e honesto, porque e so a soma do que
    aconteceu.
    """
    agregado = SessaoEstudo.objects.aggregate(
        minutos=Sum("duracao_min"), primeira=Min("inicio")
    )
    minutos = agregado["minutos"] or 0
    dias = (
        SessaoEstudo.objects.annotate(dia=TruncDate("inicio"))
        .values("dia")
        .distinct()
        .count()
    )
    primeira = agregado["primeira"]
    return {
        "minutos": minutos,
        "horas": round(minutos / 60, 1),
        "dias": dias,
        "sessoes": SessaoEstudo.objects.count(),
        "revisoes": Revisao.objects.filter(feita=True).count(),
        "dominados": Topico.objects.filter(status=Topico.DOMINADO).count(),
        "cartoes": Cartao.objects.count(),
        "desde": timezone.localtime(primeira).date().isoformat() if primeira else "",
    }


# ---------------------------------------------------------------- fim da sessao


# Janela da media de interrupcoes. Comparar o foco de hoje com o de um ano
# atras nao diz nada util: o que interessa e se hoje foi melhor que o habito
# recente.
DIAS_DA_MEDIA = 60


def media_de_interrupcoes(fora=None, dias=DIAS_DA_MEDIA):
    """Media de interrupcoes por sessao nos ultimos dias, ou None sem historico.

    `fora` tira uma sessao da conta -- a que acabou de ser salva, que nao pode
    entrar na media com que ela mesma vai ser comparada.
    """
    desde = timezone.now() - timedelta(days=dias)
    sessoes = SessaoEstudo.objects.filter(inicio__gte=desde)
    if fora is not None:
        sessoes = sessoes.exclude(pk=fora)
    media = sessoes.aggregate(media=Avg("interrupcoes"))["media"]
    return round(media, 1) if media is not None else None


def resumo_da_sessao(sessao):
    """O que a sessao que acabou de ser salva mudou, em numeros.

    Sem isto a sessao termina em nada: o cronometro zera, a lista ganha uma
    linha e o esforco de cinquenta minutos nao aparece em lugar nenhum. O que
    volta aqui e o mesmo material do dashboard -- horas da semana, sequencia,
    interrupcoes -- mas no instante em que ele acabou de se mover, que e o unico
    instante em que ele significa alguma coisa.
    """
    config = Configuracao.atual()
    hoje = timezone.localdate()
    semana = segunda_da_semana(hoje)
    inicio, fim = intervalo_semana(semana)

    minutos_semana = SessaoEstudo.objects.filter(
        inicio__gte=inicio, inicio__lt=fim
    ).aggregate(total=Sum("duracao_min"))["total"] or 0

    comeco_do_dia = timezone.make_aware(datetime.combine(hoje, time.min))
    do_dia = SessaoEstudo.objects.filter(
        inicio__gte=comeco_do_dia, inicio__lt=comeco_do_dia + timedelta(days=1)
    ).aggregate(total=Sum("duracao_min"), quantas=Count("id"))

    meta = config.meta_horas_semanais
    horas_semana = round(minutos_semana / 60, 1)

    return {
        "minutos": sessao.duracao_min,
        "topico": sessao.topico.nome,
        "materia": sessao.topico.materia.nome,
        "cor": sessao.topico.materia.cor,
        "interrupcoes": sessao.interrupcoes,
        # None quando nao ha com que comparar: dizer "0,0 de media" no primeiro
        # dia seria inventar um recorde para quebrar.
        "media_interrupcoes": media_de_interrupcoes(fora=sessao.pk),
        "minutos_do_dia": do_dia["total"] or 0,
        "sessoes_do_dia": do_dia["quantas"] or 0,
        "horas_semana": horas_semana,
        "meta_horas_semanais": meta,
        "percentual_meta": min(round(horas_semana * 100 / meta), 100) if meta else 0,
        # Quanto falta para a meta da semana, em minutos: "faltam 40 min" e uma
        # frase acionavel, "67% da meta" nao e.
        "faltam_min": max(round(meta * 60 - minutos_semana), 0) if meta else 0,
        "bateu_meta": bool(meta) and minutos_semana >= meta * 60,
        "sequencia": resumo_da_sequencia(hoje, config),
    }


# ---------------------------------------------------------------- marcos


# Degraus dos marcos de contagem. Raros de proposito: um marco que chega toda
# semana nao e um marco, e um contador.
DIAS_SEGUIDOS = (7, 30, 100, 365)
SEMANAS_NA_META = (4, 12, 52)
REVISOES_FECHADAS = (100, 500, 1000, 5000)
HORAS_ESTUDADAS = (10, 50, 100, 500, 1000)
TOPICOS_DOMINADOS = (10, 50, 100)

# A linha que marca "este perfil ja foi semeado". Nao e um marco: nunca sai em
# `marcos_de_agora`, e por isso nunca e anunciada.
SEMEADO = "_semeado"
MARCA_DA_SEMEADURA = ("Marcos ligados", "o que ja existia entrou em silencio")

# A partir de quantos dias de intervalo um topico conta como memoria de longo
# prazo. Noventa dias e o ponto em que o SM-2 deixou de estar ensinando e passou
# a estar so conferindo.
INTERVALO_LONGO = 90


def _degrau(valor, degraus):
    """O maior degrau que `valor` ja passou, ou None."""
    passados = [d for d in degraus if valor >= d]
    return max(passados) if passados else None


def marcos_de_agora(hoje=None, config=None):
    """Todos os marcos verdadeiros neste instante: chave -> (titulo, detalhe).

    Le e nao escreve. Quem decide o que anunciar e `marcos_novos`, que compara
    isto com o que ja foi dito -- a conta aqui nao sabe nem se importa se a
    pessoa ja viu.

    Cada marco e um fato que ja estava no banco. Nenhum e uma moeda, e a
    diferenca pratica e que nao da para farmar nenhum deles sem de fato estudar:
    nao ha o que clicar para ganhar "90 dias de intervalo".
    """
    hoje = hoje or timezone.localdate()
    config = config or Configuracao.atual()
    marcos = {}

    por_dia = minutos_por_dia(hoje - timedelta(days=DIAS_DO_MAPA - 1))
    _, maior_dias = sequencia(set(por_dia), hoje, config.folgas_por_semana)
    _, maior_semanas = semanas_na_meta(por_dia, hoje, config.meta_horas_semanais)

    degrau = _degrau(maior_dias, DIAS_SEGUIDOS)
    if degrau:
        marcos["dias_%d" % degrau] = (
            "%d dias seguidos" % degrau,
            "a sequência mais longa até agora",
        )

    degrau = _degrau(maior_semanas, SEMANAS_NA_META)
    if degrau:
        marcos["semanas_%d" % degrau] = (
            "%d semanas na meta" % degrau,
            "%d semanas seguidas batendo %gh" % (degrau, config.meta_horas_semanais),
        )

    total = investimento()

    degrau = _degrau(total["revisoes"], REVISOES_FECHADAS)
    if degrau:
        marcos["revisoes_%d" % degrau] = (
            "%d revisões fechadas" % degrau,
            "cada uma é um assunto que você não deixou cair",
        )

    degrau = _degrau(total["horas"], HORAS_ESTUDADAS)
    if degrau:
        marcos["horas_%d" % degrau] = (
            "%d horas estudadas" % degrau,
            "em %d dias de estudo" % total["dias"],
        )

    degrau = _degrau(total["dominados"], TOPICOS_DOMINADOS)
    if degrau:
        marcos["dominados_%d" % degrau] = (
            "%d tópicos dominados" % degrau,
            "conteúdo que saiu da fila para sempre",
        )

    # Primeiro topico dominado de cada materia: o degrau mais importante de
    # todos, porque e o que prova que a materia tem fim.
    for linha in (
        Topico.objects.filter(status=Topico.DOMINADO)
        .values("materia_id", "materia__nome")
        .distinct()
    ):
        marcos["dominado:%d" % linha["materia_id"]] = (
            "Primeiro tópico dominado em %s" % linha["materia__nome"],
            "a matéria tem fim, e você já viu um pedaço dele",
        )

    # Intervalo longo: a escada do SM-2 chegando onde ela existe para chegar.
    for topico in Topico.objects.filter(
        intervalo_dias__gte=INTERVALO_LONGO
    ).select_related("materia"):
        marcos["intervalo_longo:%d" % topico.id] = (
            "%s volta só em %d dias" % (topico.nome, topico.intervalo_dias),
            "%s · memória de longo prazo, pelo SM-2" % topico.materia.nome,
        )

    marcos.update(_marcos_de_retomada(hoje, config))
    return marcos


def _marcos_de_retomada(hoje, config):
    """Materia que estava parada e voltou a ser estudada hoje.

    Sair da lista de "paradas" e o unico evento do app que depende de ter sido
    ruim antes, e por isso o mais facil de nao notar: a materia simplesmente
    desaparece do aviso. A chave leva a data para uma retomada no ano que vem
    poder ser dita de novo -- cada volta e uma volta.
    """
    marcos = {}
    comeco = timezone.make_aware(datetime.combine(hoje, time.min))
    de_hoje = set(
        SessaoEstudo.objects.filter(inicio__gte=comeco)
        .values_list("topico__materia_id", flat=True)
        .distinct()
    )
    if not de_hoje:
        return marcos

    anteriores = (
        SessaoEstudo.objects.filter(topico__materia_id__in=de_hoje, inicio__lt=comeco)
        .values("topico__materia_id", "topico__materia__nome")
        .annotate(ultima=Max("inicio"))
    )
    for linha in anteriores:
        parada = (hoje - timezone.localtime(linha["ultima"]).date()).days
        if parada <= config.dias_materia_parada:
            continue
        chave = "retomada:%d:%s" % (linha["topico__materia_id"], hoje.isoformat())
        marcos[chave] = (
            "%s voltou" % linha["topico__materia__nome"],
            "estava parada há %d dias" % parada,
        )
    return marcos


def marcos_novos(hoje=None, config=None):
    """Os marcos ainda nao anunciados, ja gravados como anunciados.

    A primeira passada de um perfil nao anuncia nada: um app que acabou de
    importar um backup -- ou que ganhou esta funcao com um ano de historico
    dentro -- tem dezenas de marcos verdadeiros de uma vez, e trinta parabens
    juntos nao sao trinta parabens, sao ruido. A primeira passada semeia em
    silencio, e dali em diante cada marco chega no dia em que foi conquistado.

    Escreve, e por isso nao mora numa view de GET: quem chama e o POST que o
    front faz depois de mostrar o que recebeu.
    """
    # Sem dono nao ha a quem dar parabens -- e `bulk_create` nao passa pelo
    # `save()` que herdaria o perfil, entao a linha entraria sem dono e sumiria
    # do manager que filtra por ele.
    dono = atual_id()
    if dono is None:
        return []

    ja_ditos = set(Marco.objects.values_list("chave", flat=True))
    # A semeadura e um fato gravado, nao a ausencia de linhas: um perfil novo
    # nao tem marco nenhum de verdade, e inferir "primeira passada" do vazio
    # faria o primeiro marco real dele cair no silencio da semeadura -- uma vez
    # so, e para sempre, porque a segunda passada ja acharia a linha gravada.
    semeando = SEMEADO not in ja_ditos

    de_agora = marcos_de_agora(hoje, config)
    novas = [chave for chave in de_agora if chave not in ja_ditos]
    if semeando:
        novas.append(SEMEADO)

    Marco.objects.bulk_create(
        [
            Marco(
                perfil_id=dono,
                chave=chave,
                titulo=de_agora.get(chave, MARCA_DA_SEMEADURA)[0],
                detalhe=de_agora.get(chave, MARCA_DA_SEMEADURA)[1],
            )
            for chave in novas
        ],
        # Duas abas abrindo o dashboard juntas disputam as mesmas chaves; a
        # constraint decide qual grava, e a corrida perdida nao e um erro.
        ignore_conflicts=True,
    )

    if semeando:
        return []
    return [
        {"chave": c, "titulo": de_agora[c][0], "detalhe": de_agora[c][1]} for c in novas
    ]


# ---------------------------------------------------------------- lembrete


# O horario do lembrete quando nao ha planner nem historico de sessao que diga
# outro. Comeco da noite: depois da aula, antes de o dia ter acabado.
HORA_PADRAO_DO_LEMBRETE = time(19, 0)

# Quantas sessoes recentes olhar para achar a hora de costume. Duzentas cobrem
# meses de habito sem fazer a conta andar pelo banco inteiro.
SESSOES_DO_HABITO = 200


def horario_de_estudo(hoje=None):
    """A hora em que esta pessoa costuma estudar, em "HH:MM".

    Na ordem do que sabe mais: o bloco de hoje no planner (ele diz a intencao),
    depois a hora mais frequente das sessoes reais (ela diz o habito), e por fim
    um padrao. Lembrar as 7h quem estuda as 22h e o jeito mais rapido de a
    pessoa desligar o lembrete -- e um lembrete desligado nao lembra nada.
    """
    hoje = hoje or timezone.localdate()

    # `blocos_da_semana` devolve o json dos blocos, nao os modelos: as horas
    # chegam aqui como "HH:MM", que e justamente o formato de saida.
    #
    # Bloco pulado nao vale: aula cancelada nao e hora de estudo, e lembrar no
    # horario de um feriado e o jeito de o lembrete perder credito.
    horas = sorted(
        bloco["hora_inicio"]
        for bloco in blocos_da_semana(segunda_da_semana(hoje))
        if bloco["dia_semana"] == hoje.weekday()
        and bloco["tipo"] != BlocoPlanejado.OUTRO
        and not bloco["pulado"]
    )
    if horas:
        return horas[0]

    horas = {}
    for inicio in SessaoEstudo.objects.values_list("inicio", flat=True)[
        :SESSOES_DO_HABITO
    ]:
        hora = timezone.localtime(inicio).hour
        horas[hora] = horas.get(hora, 0) + 1
    if horas:
        # Empate desce para a hora mais cedo: e a que ainda deixa o dia salvar.
        melhor = max(horas, key=lambda h: (horas[h], -h))
        return "%02d:00" % melhor

    return HORA_PADRAO_DO_LEMBRETE.strftime("%H:%M")


def dados_lembrete(hoje=None, config=None):
    """O lembrete do dia: se ha o que lembrar, a que hora, e em que palavras.

    A regra do texto e a do resto do app: o que esta em jogo, nunca o que foi
    falhado. "6 dias seguidos em pe - 4 revisoes pedem 10 min" faz abrir; "voce
    nao estudou hoje" faz fechar a aba e desinstalar na semana seguinte.

    So vale lembrar quem ainda nao estudou hoje: notificacao sem conteudo e o
    que ensina a ignorar as proximas.
    """
    hoje = hoje or timezone.localdate()
    config = config or Configuracao.atual()
    corrida = resumo_da_sequencia(hoje, config)
    pendentes = restantes_do_dia(hoje, config)

    partes = []
    if corrida["dias"] and not corrida["estudou_hoje"]:
        partes.append("%d dias seguidos em pé" % corrida["dias"])
    if pendentes:
        # Dois minutos por revisao e o que uma fila de cartoes custa de fato; o
        # tamanho dito em minutos e o que faz a pessoa comecar.
        minutos = max(pendentes * 2, 5)
        uma = pendentes == 1
        partes.append(
            "%d %s %s %d min"
            % (pendentes, "revisão" if uma else "revisões", "pede" if uma else "pedem", minutos)
        )
    elif not corrida["estudou_hoje"]:
        partes.append("nada na fila — um pomodoro já segura o dia")

    return {
        "ativo": config.lembrete_ativo,
        "hora": (
            config.lembrete_hora.strftime("%H:%M")
            if config.lembrete_hora
            else horario_de_estudo(hoje)
        ),
        "automatico": config.lembrete_hora is None,
        "estudou_hoje": corrida["estudou_hoje"],
        "pendentes": pendentes,
        "dias": corrida["dias"],
        "folgas_restantes": corrida["folgas_restantes"],
        "vale_lembrar": not corrida["estudou_hoje"],
        "texto": " · ".join(partes),
    }
