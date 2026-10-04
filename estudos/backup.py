"""Backup do banco inteiro em um JSON, e a volta.

O app guarda tudo num SQLite local sem nenhuma copia: um arquivo perdido e o
historico inteiro perdido. Aqui ficam as duas pontas -- `exportar` monta o
dicionario que vira o arquivo, `importar` le esse arquivo de volta.

Os `id` do arquivo sao internos: servem so para ligar topico a materia dentro
do proprio JSON. Na importacao tudo recebe id novo, e o que ja existe no banco
e reaproveitado em vez de duplicar (mesma regra do import de .ics).
"""

from datetime import date, datetime, time, timedelta

from django.db import transaction
from django.utils import timezone

from .models import (
    Avaliacao,
    Configuracao,
    BlocoPlanejado,
    Cartao,
    Material,
    Materia,
    OcorrenciaPulada,
    RespostaRevisao,
    Revisao,
    SessaoEstudo,
    Topico,
)

VERSAO = 7

# Versoes antigas que ainda sabemos ler. Cada uma e de antes de uma secao nova
# (1: avaliacoes, 2: cartoes, 3: notas e material, 4: interrupcoes, 5: ajustes,
# 6: log de respostas): o arquivo simplesmente nao tem a secao ou o campo, e
# importar continua indo.
VERSOES_ACEITAS = (1, 2, 3, 4, 5, 6, 7)

# Quanto o arquivo pode ter de texto. Um backup real tem alguns KB; o limite
# existe para o navegador nao mandar um arquivo trocado de 500 MB. Fica abaixo
# do DATA_UPLOAD_MAX_MEMORY_SIZE do Django (2,5 MB) para a recusa sair como
# JSON com mensagem em vez da pagina de erro 413 dele.
LIMITE_BYTES = 2 * 1024 * 1024


# ---------------------------------------------------------------- exportar


def exportar():
    """Devolve o banco inteiro como dicionario pronto para `json.dumps`."""
    puladas = {}
    for pulada in OcorrenciaPulada.objects.all():
        puladas.setdefault(pulada.bloco_id, []).append(pulada.semana.isoformat())

    return {
        "app": "estudos",
        "versao": VERSAO,
        "gerado_em": timezone.localtime().isoformat(timespec="seconds"),
        "configuracao": Configuracao.atual().json(),
        "materias": [
            {
                "id": m.id,
                "nome": m.nome,
                "cor": m.cor,
                "meta_horas_semanais": m.meta_horas_semanais,
            }
            for m in Materia.objects.all()
        ],
        # Ordenado por nivel: o pai sempre aparece antes do filho, para a
        # importacao poder ligar um no outro numa passada so.
        "topicos": [
            {
                "id": t.id,
                "materia_id": t.materia_id,
                "pai_id": t.pai_id,
                "nome": t.nome,
                "status": t.status,
                "notas": t.notas,
                "facilidade": t.facilidade,
                "intervalo_dias": t.intervalo_dias,
                "acertos_seguidos": t.acertos_seguidos,
            }
            for t in sorted(
                Topico.objects.select_related("pai__pai"), key=lambda t: t.nivel
            )
        ],
        # So os links. O arquivo anexado mora em MEDIA_ROOT e nao cabe num JSON;
        # a copia dele e copiar a pasta "arquivos/".
        "materiais": [
            {
                "topico_id": m.topico_id,
                "titulo": m.titulo,
                "url": m.url,
                "nota": m.nota,
            }
            for m in Material.objects.exclude(url="")
        ],
        "cartoes": [
            {
                "topico_id": c.topico_id,
                "frente": c.frente,
                "verso": c.verso,
                "ordem": c.ordem,
            }
            for c in Cartao.objects.all()
        ],
        "sessoes": [
            {
                "topico_id": s.topico_id,
                "inicio": timezone.localtime(s.inicio).isoformat(timespec="seconds"),
                "duracao_min": s.duracao_min,
                "nota": s.nota,
                "interrupcoes": s.interrupcoes,
            }
            for s in SessaoEstudo.objects.all()
        ],
        "blocos": [
            {
                "tipo": b.tipo,
                "titulo": b.titulo,
                "descricao": b.descricao,
                "materia_id": b.materia_id,
                "topico_id": b.topico_id,
                "semana": b.semana.isoformat() if b.semana else None,
                "dia_semana": b.dia_semana,
                "hora_inicio": b.hora_inicio.strftime("%H:%M"),
                "hora_fim": b.hora_fim.strftime("%H:%M"),
                "puladas": puladas.get(b.id, []),
            }
            for b in BlocoPlanejado.objects.all()
        ],
        "avaliacoes": [
            {
                "materia_id": a.materia_id,
                "topico_ids": [t.id for t in a.topicos.all()],
                "tipo": a.tipo,
                "titulo": a.titulo,
                "descricao": a.descricao,
                "data": a.data.isoformat(),
                "hora": a.hora.strftime("%H:%M") if a.hora else None,
                "peso": a.peso,
                "nota": a.nota,
                "concluida": a.concluida,
            }
            for a in Avaliacao.objects.prefetch_related("topicos")
        ],
        # O log das respostas: a unica parte do banco que nao se recalcula. A
        # facilidade de hoje da para ver no topico; "errei isto tres vezes em
        # maio" existe so aqui.
        "respostas": [
            {
                "topico_id": r.topico_id,
                "qualidade": r.qualidade,
                "respondida_em": timezone.localtime(r.respondida_em).isoformat(
                    timespec="seconds"
                ),
                "data_prevista": r.data_prevista.isoformat(),
                "atraso_dias": r.atraso_dias,
                "status_antes": r.status_antes,
                "facilidade_antes": r.facilidade_antes,
                "intervalo_antes": r.intervalo_antes,
                "acertos_antes": r.acertos_antes,
                "facilidade_depois": r.facilidade_depois,
                "intervalo_depois": r.intervalo_depois,
            }
            for r in RespostaRevisao.objects.all()
        ],
        "revisoes": [
            {
                "topico_id": r.topico_id,
                "data_prevista": r.data_prevista.isoformat(),
                "feita": r.feita,
                "dificil": r.dificil,
                "qualidade": r.qualidade,
                "feita_em": (
                    timezone.localtime(r.feita_em).isoformat(timespec="seconds")
                    if r.feita_em
                    else None
                ),
            }
            for r in Revisao.objects.all()
        ],
    }


def nome_do_arquivo(agora=None):
    agora = agora or timezone.localtime()
    return f"estudos-backup-{agora:%Y-%m-%d-%H%M}.json"


# ---------------------------------------------------------------- ler campos

# As funcoes abaixo nunca confiam no arquivo: cada campo e conferido e, quando
# esta errado, a mensagem diz qual linha do backup esta com problema.


def _lista(dados, chave):
    valor = dados.get(chave, [])
    if valor is None:
        return []
    if not isinstance(valor, list):
        raise ValueError(f'"{chave}" deveria ser uma lista.')
    for item in valor:
        if not isinstance(item, dict):
            raise ValueError(f'"{chave}" tem um item que não é um objeto.')
    return valor


def _texto(item, chave, onde, obrigatorio=False, limite=None):
    valor = item.get(chave)
    if valor is None:
        valor = ""
    if not isinstance(valor, str):
        raise ValueError(f'{onde}: "{chave}" deveria ser texto.')
    valor = valor.strip()
    if obrigatorio and not valor:
        raise ValueError(f'{onde}: "{chave}" está vazio.')
    if limite and len(valor) > limite:
        valor = valor[:limite]
    return valor


def _inteiro(item, chave, onde, minimo=None, maximo=None):
    valor = item.get(chave)
    if isinstance(valor, bool) or not isinstance(valor, int):
        raise ValueError(f'{onde}: "{chave}" deveria ser um número inteiro.')
    if minimo is not None and valor < minimo:
        raise ValueError(f'{onde}: "{chave}" fora da faixa esperada.')
    if maximo is not None and valor > maximo:
        raise ValueError(f'{onde}: "{chave}" fora da faixa esperada.')
    return valor


def _decimal(item, chave, onde):
    valor = item.get(chave, 0) or 0
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        raise ValueError(f'{onde}: "{chave}" deveria ser um número.')
    return max(float(valor), 0)


def _data(item, chave, onde, obrigatorio=True):
    valor = item.get(chave)
    if valor in (None, ""):
        if obrigatorio:
            raise ValueError(f'{onde}: "{chave}" está vazio.')
        return None
    try:
        return date.fromisoformat(str(valor)[:10])
    except ValueError:
        raise ValueError(f'{onde}: "{chave}" não é uma data (AAAA-MM-DD).')


def _hora(item, chave, onde):
    valor = str(item.get(chave) or "")
    try:
        return time.fromisoformat(valor)
    except ValueError:
        raise ValueError(f'{onde}: "{chave}" não é um horário (HH:MM).')


def _momento(item, chave, onde, obrigatorio=True):
    """Le um datetime ISO. Sem fuso no texto, assume o fuso do app."""
    valor = item.get(chave)
    if valor in (None, ""):
        if obrigatorio:
            raise ValueError(f'{onde}: "{chave}" está vazio.')
        return None
    try:
        momento = datetime.fromisoformat(str(valor))
    except ValueError:
        raise ValueError(f'{onde}: "{chave}" não é uma data e hora ISO.')
    if timezone.is_naive(momento):
        momento = timezone.make_aware(momento)
    return momento


def _escolha(item, chave, onde, validas, padrao):
    valor = item.get(chave) or padrao
    if valor not in validas:
        raise ValueError(f'{onde}: "{chave}" tem o valor desconhecido "{valor}".')
    return valor


def _referencia(item, chave, onde, mapa, obrigatorio=True):
    """Resolve um id do arquivo para o objeto ja gravado no banco."""
    bruto = item.get(chave)
    if bruto is None:
        if obrigatorio:
            raise ValueError(f'{onde}: "{chave}" está vazio.')
        return None
    if bruto not in mapa:
        raise ValueError(f'{onde}: "{chave}" aponta para um registro que não está no arquivo.')
    return mapa[bruto]


# ---------------------------------------------------------------- importar


def conferir(dados):
    """Valida a casca do arquivo antes de abrir qualquer transacao."""
    if not isinstance(dados, dict):
        raise ValueError("O arquivo não é um backup do Estudos.")
    if dados.get("app") != "estudos":
        raise ValueError("O arquivo não é um backup do Estudos.")
    versao = dados.get("versao")
    if versao not in VERSOES_ACEITAS:
        raise ValueError(
            f"Backup na versão {versao!r}; este app lê as versões "
            f"{', '.join(str(v) for v in VERSOES_ACEITAS)}."
        )
    return dados


@transaction.atomic
def importar(dados, substituir=False):
    """Grava o backup. `substituir=True` apaga o banco antes.

    Sem substituir, o que ja existe e reaproveitado: materia pelo nome, topico
    pelo nome dentro do mesmo pai, sessao pelo instante de inicio, bloco pelo
    titulo mais dia e horario, revisao pela data prevista. Reimportar o mesmo
    arquivo duas vezes nao duplica nada.
    """
    conferir(dados)

    # Os ajustes vem junto para o backup restaurar o app inteiro, nao so os
    # dados. Arquivo sem a secao (versoes antigas) deixa os ajustes como estao.
    ajustes = dados.get("configuracao") or {}
    if ajustes and not isinstance(ajustes, dict):
        raise ValueError('"configuracao" deveria ser um objeto.')

    materias = _lista(dados, "materias")
    topicos = _lista(dados, "topicos")
    cartoes = _lista(dados, "cartoes")
    materiais = _lista(dados, "materiais")
    sessoes = _lista(dados, "sessoes")
    blocos = _lista(dados, "blocos")
    avaliacoes = _lista(dados, "avaliacoes")
    revisoes = _lista(dados, "revisoes")
    respostas = _lista(dados, "respostas")

    if substituir:
        # Materia em cascata leva topico, sessao e revisao; bloco solto (sem
        # materia) e ocorrencia pulada precisam ir na mao.
        OcorrenciaPulada.objects.all().delete()
        BlocoPlanejado.objects.all().delete()
        Materia.objects.all().delete()

    resumo = {
        chave: 0
        for chave in (
            "materias",
            "topicos",
            "cartoes",
            "materiais",
            "sessoes",
            "blocos",
            "avaliacoes",
            "revisoes",
            "respostas",
        )
    }
    repetidos = dict(resumo)

    mapa_materias = {}
    for i, item in enumerate(materias, 1):
        onde = f"matéria {i}"
        nome = _texto(item, "nome", onde, obrigatorio=True, limite=80)
        materia = Materia.objects.filter(nome=nome).first()
        if materia:
            repetidos["materias"] += 1
        else:
            materia = Materia.objects.create(
                nome=nome,
                cor=_texto(item, "cor", onde, limite=7) or "#4f8cff",
                meta_horas_semanais=_decimal(item, "meta_horas_semanais", onde),
            )
            resumo["materias"] += 1
        if "id" in item:
            mapa_materias[item["id"]] = materia

    mapa_topicos = {}
    for i, item in enumerate(topicos, 1):
        onde = f"tópico {i}"
        materia = _referencia(item, "materia_id", onde, mapa_materias)
        pai = _referencia(item, "pai_id", onde, mapa_topicos, obrigatorio=False)
        if pai and pai.nivel >= 3:
            raise ValueError(f"{onde}: a árvore de tópicos passa de três níveis.")
        nome = _texto(item, "nome", onde, obrigatorio=True, limite=140)
        topico = Topico.objects.filter(materia=materia, pai=pai, nome=nome).first()
        if topico:
            repetidos["topicos"] += 1
        else:
            topico = Topico.objects.create(
                materia=materia,
                pai=pai,
                nome=nome,
                status=_escolha(
                    item, "status", onde, dict(Topico.STATUS), Topico.NAO_INICIADO
                ),
                notas=_texto(item, "notas", onde),
                facilidade=(
                    _decimal(item, "facilidade", onde) if "facilidade" in item else 2.5
                ),
                intervalo_dias=(
                    _inteiro(item, "intervalo_dias", onde, minimo=0, maximo=36500)
                    if "intervalo_dias" in item
                    else 0
                ),
                acertos_seguidos=(
                    _inteiro(item, "acertos_seguidos", onde, minimo=0, maximo=10000)
                    if "acertos_seguidos" in item
                    else 0
                ),
            )
            resumo["topicos"] += 1
        if "id" in item:
            mapa_topicos[item["id"]] = topico

    for i, item in enumerate(cartoes, 1):
        onde = f"cartão {i}"
        topico = _referencia(item, "topico_id", onde, mapa_topicos)
        frente = _texto(item, "frente", onde, obrigatorio=True)
        if Cartao.objects.filter(topico=topico, frente=frente).exists():
            repetidos["cartoes"] += 1
            continue
        Cartao.objects.create(
            topico=topico,
            frente=frente,
            verso=_texto(item, "verso", onde, obrigatorio=True),
            ordem=_inteiro(item, "ordem", onde, minimo=0, maximo=10000)
            if "ordem" in item
            else 0,
        )
        resumo["cartoes"] += 1

    for i, item in enumerate(materiais, 1):
        onde = f"material {i}"
        topico = _referencia(item, "topico_id", onde, mapa_topicos)
        url = _texto(item, "url", onde, obrigatorio=True, limite=500)
        if not url.lower().startswith(("http://", "https://")):
            raise ValueError(f"{onde}: o link precisa começar com http:// ou https://.")
        if Material.objects.filter(topico=topico, url=url).exists():
            repetidos["materiais"] += 1
            continue
        Material.objects.create(
            topico=topico,
            titulo=_texto(item, "titulo", onde, limite=160) or url[:160],
            url=url,
            nota=_texto(item, "nota", onde, limite=200),
        )
        resumo["materiais"] += 1

    for i, item in enumerate(sessoes, 1):
        onde = f"sessão {i}"
        topico = _referencia(item, "topico_id", onde, mapa_topicos)
        inicio = _momento(item, "inicio", onde)
        # O backup grava o inicio com precisao de segundo; a sessao no banco tem
        # microssegundos. A comparacao e pelo segundo, senao nada casa.
        if SessaoEstudo.objects.filter(
            topico=topico,
            inicio__gte=inicio.replace(microsecond=0),
            inicio__lt=inicio.replace(microsecond=0) + timedelta(seconds=1),
        ).exists():
            repetidos["sessoes"] += 1
            continue
        SessaoEstudo.objects.create(
            topico=topico,
            inicio=inicio,
            duracao_min=_inteiro(item, "duracao_min", onde, minimo=0, maximo=24 * 60),
            nota=_texto(item, "nota", onde),
            interrupcoes=(
                _inteiro(item, "interrupcoes", onde, minimo=0, maximo=999)
                if "interrupcoes" in item
                else 0
            ),
        )
        resumo["sessoes"] += 1

    for i, item in enumerate(blocos, 1):
        onde = f"bloco {i}"
        materia = _referencia(item, "materia_id", onde, mapa_materias, obrigatorio=False)
        topico = _referencia(item, "topico_id", onde, mapa_topicos, obrigatorio=False)
        semana = _data(item, "semana", onde, obrigatorio=False)
        titulo = _texto(item, "titulo", onde, limite=120)
        dia_semana = _inteiro(item, "dia_semana", onde, minimo=0, maximo=6)
        hora_inicio = _hora(item, "hora_inicio", onde)
        hora_fim = _hora(item, "hora_fim", onde)
        if hora_fim <= hora_inicio:
            raise ValueError(f"{onde}: o fim é antes do início.")

        bloco = BlocoPlanejado.objects.filter(
            titulo=titulo,
            semana=semana,
            dia_semana=dia_semana,
            hora_inicio=hora_inicio,
            hora_fim=hora_fim,
        ).first()
        if bloco:
            repetidos["blocos"] += 1
        else:
            bloco = BlocoPlanejado.objects.create(
                tipo=_escolha(
                    item, "tipo", onde, dict(BlocoPlanejado.TIPOS), BlocoPlanejado.ESTUDO
                ),
                titulo=titulo,
                descricao=_texto(item, "descricao", onde),
                materia=materia,
                topico=topico,
                semana=semana,
                dia_semana=dia_semana,
                hora_inicio=hora_inicio,
                hora_fim=hora_fim,
            )
            resumo["blocos"] += 1

        for bruto in item.get("puladas") or []:
            pulada = _data({"semana": bruto}, "semana", f"{onde} (pulada)")
            OcorrenciaPulada.objects.get_or_create(bloco=bloco, semana=pulada)

    for i, item in enumerate(avaliacoes, 1):
        onde = f"avaliação {i}"
        materia = _referencia(item, "materia_id", onde, mapa_materias)
        data = _data(item, "data", onde)
        titulo = _texto(item, "titulo", onde, obrigatorio=True, limite=120)

        avaliacao = Avaliacao.objects.filter(
            materia=materia, titulo=titulo, data=data
        ).first()
        if avaliacao:
            repetidos["avaliacoes"] += 1
            continue

        hora = None
        if item.get("hora"):
            hora = _hora(item, "hora", onde)
        nota = item.get("nota")
        if nota is not None and (isinstance(nota, bool) or not isinstance(nota, (int, float))):
            raise ValueError(f'{onde}: "nota" deveria ser um número.')

        avaliacao = Avaliacao.objects.create(
            materia=materia,
            tipo=_escolha(item, "tipo", onde, dict(Avaliacao.TIPOS), Avaliacao.PROVA),
            titulo=titulo,
            descricao=_texto(item, "descricao", onde),
            data=data,
            hora=hora,
            peso=_decimal(item, "peso", onde),
            nota=None if nota is None else float(nota),
            concluida=bool(item.get("concluida")),
        )
        resumo["avaliacoes"] += 1

        ids = item.get("topico_ids") or []
        if not isinstance(ids, list):
            raise ValueError(f'{onde}: "topico_ids" deveria ser uma lista.')
        avaliacao.topicos.set(
            [_referencia({"t": bruto}, "t", onde, mapa_topicos) for bruto in ids]
        )

    for i, item in enumerate(revisoes, 1):
        onde = f"revisão {i}"
        topico = _referencia(item, "topico_id", onde, mapa_topicos)
        data_prevista = _data(item, "data_prevista", onde)
        if Revisao.objects.filter(topico=topico, data_prevista=data_prevista).exists():
            repetidos["revisoes"] += 1
            continue
        Revisao.objects.create(
            topico=topico,
            data_prevista=data_prevista,
            feita=bool(item.get("feita")),
            dificil=bool(item.get("dificil")),
            qualidade=(
                _inteiro(item, "qualidade", onde, minimo=0, maximo=5)
                if item.get("qualidade") is not None
                else None
            ),
            feita_em=_momento(item, "feita_em", onde, obrigatorio=False),
        )
        resumo["revisoes"] += 1

    for i, item in enumerate(respostas, 1):
        onde = f"resposta {i}"
        topico = _referencia(item, "topico_id", onde, mapa_topicos)
        respondida_em = _momento(item, "respondida_em", onde)
        # Duas respostas do mesmo topico no mesmo segundo seriam a mesma
        # resposta importada duas vezes.
        if RespostaRevisao.objects.filter(
            topico=topico,
            respondida_em__gte=respondida_em.replace(microsecond=0),
            respondida_em__lt=respondida_em.replace(microsecond=0) + timedelta(seconds=1),
        ).exists():
            repetidos["respostas"] += 1
            continue
        RespostaRevisao.objects.create(
            topico=topico,
            revisao=None,
            qualidade=_inteiro(item, "qualidade", onde, minimo=0, maximo=5),
            respondida_em=respondida_em,
            data_prevista=_data(item, "data_prevista", onde),
            atraso_dias=_inteiro(item, "atraso_dias", onde, minimo=0, maximo=36500)
            if "atraso_dias" in item
            else 0,
            status_antes=_escolha(
                item, "status_antes", onde, dict(Topico.STATUS), Topico.NAO_INICIADO
            ),
            facilidade_antes=_decimal(item, "facilidade_antes", onde),
            intervalo_antes=_inteiro(item, "intervalo_antes", onde, minimo=0, maximo=36500),
            acertos_antes=_inteiro(item, "acertos_antes", onde, minimo=0, maximo=10000),
            facilidade_depois=_decimal(item, "facilidade_depois", onde),
            intervalo_depois=_inteiro(item, "intervalo_depois", onde, minimo=0, maximo=36500),
        )
        resumo["respostas"] += 1

    if ajustes:
        config = Configuracao.atual()
        for nome in [c.name for c in Configuracao._meta.fields if c.name != "id"]:
            if nome in ajustes:
                setattr(config, nome, ajustes[nome])
        config.save()

    return {
        "criados": resumo,
        "existentes": repetidos,
        "substituiu": substituir,
        "ajustes": bool(ajustes),
    }


def resumir(dados):
    """Quantos registros o arquivo tem, para o botao "Conferir" nao gravar nada."""
    conferir(dados)
    return {
        "gerado_em": dados.get("gerado_em") or "",
        "materias": len(_lista(dados, "materias")),
        "topicos": len(_lista(dados, "topicos")),
        "cartoes": len(_lista(dados, "cartoes")),
        "materiais": len(_lista(dados, "materiais")),
        "sessoes": len(_lista(dados, "sessoes")),
        "blocos": len(_lista(dados, "blocos")),
        "avaliacoes": len(_lista(dados, "avaliacoes")),
        "revisoes": len(_lista(dados, "revisoes")),
        "respostas": len(_lista(dados, "respostas")),
    }
