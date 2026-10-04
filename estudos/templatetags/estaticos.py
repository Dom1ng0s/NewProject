"""Link de arquivo estatico com a data de modificacao na query.

O runserver nao manda cabecalho de expiracao, entao o navegador costuma
reaproveitar um CSS/JS antigo depois de uma edicao. O sufixo ?v=<mtime>
muda a URL a cada alteracao e obriga o download do arquivo novo.

Num CSS que so faz `@import`, a data do proprio arquivo nunca muda -- quem muda
sao os importados. Por isso a data usada e a mais recente entre o arquivo e tudo
que ele importa, recursivamente.
"""

import re
from pathlib import Path

from django import template
from django.conf import settings
from django.templatetags.static import static

register = template.Library()

IMPORTE = re.compile(r"""@import\s+(?:url\(\s*)?["']([^"')]+)["']""")


def achar(caminho):
    for pasta in settings.STATICFILES_DIRS:
        arquivo = Path(pasta) / caminho
        if arquivo.exists():
            return arquivo
    return None


def mais_recente(arquivo, vistos=None):
    """Maior mtime entre o arquivo e os CSS que ele importa."""
    vistos = vistos if vistos is not None else set()
    if arquivo in vistos:
        return 0
    vistos.add(arquivo)

    data = int(arquivo.stat().st_mtime)
    if arquivo.suffix != ".css":
        return data

    try:
        texto = arquivo.read_text(encoding="utf-8")
    except OSError:
        return data

    for alvo in IMPORTE.findall(texto):
        if "//" in alvo:  # importe de fora (fonte, CDN): nao e arquivo nosso
            continue
        vizinho = (arquivo.parent / alvo).resolve()
        if vizinho.exists():
            data = max(data, mais_recente(vizinho, vistos))
    return data


@register.simple_tag
def estatico(caminho):
    url = static(caminho)
    arquivo = achar(caminho)
    return f"{url}?v={mais_recente(arquivo)}" if arquivo else url
