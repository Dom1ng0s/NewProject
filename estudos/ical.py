"""Leitor minimo de iCalendar (RFC 5545), so com biblioteca padrao.

Cobre o que um calendario de faculdade costuma exportar: VEVENT com SUMMARY,
DTSTART/DTEND e, quando a aula se repete, RRULE semanal. O resto e ignorado de
proposito -- a ideia nao e implementar o RFC inteiro, e sim virar grade semanal.
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone

DIAS_RRULE = {"MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6}


def desdobrar(texto):
    """Junta as continuacoes de linha (uma linha longa quebrada com espaco)."""
    texto = texto.replace("\r\n", "\n").replace("\r", "\n")
    return texto.replace("\n ", "").replace("\n\t", "")


def destacar(valor):
    """Desfaz os escapes de texto do RFC."""
    saida = []
    i = 0
    while i < len(valor):
        if valor[i] == "\\" and i + 1 < len(valor):
            seguinte = valor[i + 1]
            saida.append({"n": "\n", "N": "\n"}.get(seguinte, seguinte))
            i += 2
        else:
            saida.append(valor[i])
            i += 1
    return "".join(saida)


def partir_linha(linha):
    """'DTSTART;TZID=X:2026...' -> ('DTSTART', {'TZID': 'X'}, '2026...')"""
    if ":" not in linha:
        return None
    cabecalho, valor = linha.split(":", 1)
    partes = cabecalho.split(";")
    nome = partes[0].upper()
    params = {}
    for parte in partes[1:]:
        if "=" in parte:
            chave, conteudo = parte.split("=", 1)
            params[chave.upper()] = conteudo.strip('"')
    return nome, params, valor


def ler_data(valor, params):
    """Devolve (datetime local, dia_inteiro)."""
    valor = valor.strip()
    if params.get("VALUE") == "DATE" or len(valor) == 8:
        return datetime.strptime(valor[:8], "%Y%m%d"), True

    bruto = valor.rstrip("Z")
    try:
        momento = datetime.strptime(bruto, "%Y%m%dT%H%M%S")
    except ValueError:
        return None, False

    if valor.endswith("Z"):
        momento = momento.replace(tzinfo=ZoneInfo("UTC"))
    elif params.get("TZID"):
        try:
            momento = momento.replace(tzinfo=ZoneInfo(params["TZID"]))
        except (ZoneInfoNotFoundError, ValueError):
            return momento, False  # fuso desconhecido: trata como hora local
    else:
        return momento, False  # sem fuso: ja e hora local

    return timezone.localtime(momento), False


def ler_duracao(valor):
    """Converte DURATION do tipo 'PT1H30M' em minutos."""
    if not valor.startswith("P"):
        return 0
    minutos = 0
    numero = ""
    for caractere in valor[1:]:
        if caractere.isdigit():
            numero += caractere
        else:
            if numero:
                valor_num = int(numero)
                minutos += {
                    "D": valor_num * 1440,
                    "H": valor_num * 60,
                    "M": valor_num,
                    "S": 0,
                }.get(caractere.upper(), 0)
            numero = ""
    return minutos


def ler_rrule(valor):
    regra = {}
    for parte in valor.split(";"):
        if "=" in parte:
            chave, conteudo = parte.split("=", 1)
            regra[chave.upper()] = conteudo
    return regra


def eventos_de_ics(texto, limite=500):
    """Le o arquivo e devolve eventos ja no formato que o planner usa.

    Cada evento: titulo, dia_semana, hora_inicio, hora_fim, recorrente, data,
    e, quando nao da para aproveitar, o motivo em `ignorado`.
    """
    eventos = []
    dentro = False
    atual = {}

    for linha in desdobrar(texto).split("\n"):
        linha = linha.strip()
        if not linha:
            continue
        if linha.upper() == "BEGIN:VEVENT":
            dentro, atual = True, {}
            continue
        if linha.upper() == "END:VEVENT":
            if dentro:
                eventos.extend(montar(atual))
                if len(eventos) >= limite:
                    break
            dentro = False
            continue
        if not dentro:
            continue

        partido = partir_linha(linha)
        if not partido:
            continue
        nome, params, valor = partido
        if nome in ("SUMMARY", "LOCATION"):
            atual[nome] = destacar(valor).strip()
        elif nome in ("DTSTART", "DTEND"):
            atual[nome] = (valor, params)
        elif nome in ("RRULE", "DURATION"):
            atual[nome] = valor

    return eventos[:limite]


def montar(bruto):
    """Transforma um VEVENT cru em um ou mais blocos (BYDAY pode ter varios dias)."""
    titulo = bruto.get("SUMMARY") or "Sem título"
    if "DTSTART" not in bruto:
        return [{"titulo": titulo, "ignorado": "sem data de início"}]

    inicio, dia_inteiro = ler_data(*bruto["DTSTART"])
    if inicio is None:
        return [{"titulo": titulo, "ignorado": "data em formato não reconhecido"}]
    if dia_inteiro:
        return [{"titulo": titulo, "ignorado": "evento de dia inteiro, sem horário"}]

    fim = None
    if "DTEND" in bruto:
        fim, _ = ler_data(*bruto["DTEND"])
    elif "DURATION" in bruto:
        minutos = ler_duracao(bruto["DURATION"])
        fim = inicio + timedelta(minutes=minutos) if minutos else None
    if fim is None:
        fim = inicio + timedelta(hours=1)  # sem fim declarado: assume 1 hora

    if fim.date() != inicio.date():
        return [{"titulo": titulo, "ignorado": "evento atravessa a meia-noite"}]
    if fim <= inicio:
        return [{"titulo": titulo, "ignorado": "fim antes do início"}]

    regra = ler_rrule(bruto["RRULE"]) if "RRULE" in bruto else {}
    recorrente = regra.get("FREQ", "").upper() == "WEEKLY"

    if recorrente and regra.get("UNTIL"):
        ate, _ = ler_data(regra["UNTIL"], {})
        if ate and ate.date() < timezone.localdate():
            return [{"titulo": titulo, "ignorado": "repetição já terminou"}]

    if recorrente and regra.get("BYDAY"):
        dias = [DIAS_RRULE[d[-2:]] for d in regra["BYDAY"].split(",") if d[-2:] in DIAS_RRULE]
    else:
        dias = [inicio.weekday()]

    base = {
        "titulo": titulo,
        "local": bruto.get("LOCATION", ""),
        "hora_inicio": inicio.strftime("%H:%M"),
        "hora_fim": fim.strftime("%H:%M"),
        "recorrente": recorrente,
        "data": inicio.date().isoformat(),
        "ignorado": "",
    }
    return [dict(base, dia_semana=dia) for dia in dias or [inicio.weekday()]]
