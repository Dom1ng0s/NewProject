"""Gera os PNG do icone do app: o cubo isometrico da marca, em Python puro.

Um atalho na tela inicial precisa de PNG -- o Android aceita SVG no manifesto,
o iOS nao aceita nenhum -- e desenhar o cubo a mao em quatro tamanhos seria
quatro arquivos para esquecer de atualizar juntos. Entao o icone e gerado do
mesmo poligono que o SVG da marca usa, com as mesmas cores dos tokens.

Em Python puro de proposito: instalar uma biblioteca de imagem para escrever
quatro arquivos que mudam uma vez por ano seria uma dependencia nova no
`requirements.txt` de um app que nao tem nenhuma alem do Django.

    python manage.py gerar_icones
"""

import struct
import zlib
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

# As tres faces do cubo, nas coordenadas do SVG da marca (viewBox 0 0 24 24).
FACES = [
    ([(12, 1.5), (22, 7), (12, 12.5), (2, 7)], 1.00),   # topo
    ([(2, 7), (12, 12.5), (12, 23), (2, 17.5)], 0.66),  # esquerda
    ([(22, 7), (22, 17.5), (12, 23), (12, 12.5)], 0.38),  # direita
]

FUNDO = (21, 22, 26)      # --tinta-900
AMBAR = (226, 105, 15)    # --ambar-500
AMOSTRAS = 4              # supersampling: 4x4 por pixel


def dentro(poligono, x, y):
    """Ponto dentro do polígono convexo? Mesmo sinal em todas as arestas."""
    sinal = 0
    n = len(poligono)
    for i in range(n):
        ax, ay = poligono[i]
        bx, by = poligono[(i + 1) % n]
        cruz = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
        if cruz == 0:
            continue
        atual = 1 if cruz > 0 else -1
        if sinal == 0:
            sinal = atual
        elif sinal != atual:
            return False
    return True


def cor_do_ponto(x, y, lado, margem):
    """Cor do cubo naquele ponto do SVG, ou None se for fundo."""
    escala = (lado - 2 * margem) / 24
    u = (x - margem) / escala
    v = (y - margem) / escala
    for poligono, opacidade in FACES:
        if dentro(poligono, u, v):
            return tuple(
                round(f * opacidade + t * (1 - opacidade))
                for f, t in zip(AMBAR, FUNDO)
            )
    return None


def desenhar(lado, margem):
    linhas = []
    for py in range(lado):
        linha = bytearray()
        for px in range(lado):
            soma = [0, 0, 0]
            for sy in range(AMOSTRAS):
                for sx in range(AMOSTRAS):
                    x = px + (sx + 0.5) / AMOSTRAS
                    y = py + (sy + 0.5) / AMOSTRAS
                    cor = cor_do_ponto(x, y, lado, margem) or FUNDO
                    for c in range(3):
                        soma[c] += cor[c]
            total = AMOSTRAS * AMOSTRAS
            linha += bytes(round(c / total) for c in soma)
        linhas.append(bytes(linha))
    return linhas


def png(caminho, lado, margem):
    cru = b"".join(b"\x00" + linha for linha in desenhar(lado, margem))

    def bloco(tipo, dados):
        corpo = tipo + dados
        return struct.pack(">I", len(dados)) + corpo + struct.pack(
            ">I", zlib.crc32(corpo) & 0xFFFFFFFF
        )

    cabecalho = struct.pack(">IIBBBBB", lado, lado, 8, 2, 0, 0, 0)
    arquivo = (
        b"\x89PNG\r\n\x1a\n"
        + bloco(b"IHDR", cabecalho)
        + bloco(b"IDAT", zlib.compress(cru, 9))
        + bloco(b"IEND", b"")
    )
    Path(caminho).write_bytes(arquivo)


class Command(BaseCommand):
    help = "Redesenha os icones do app (static/icone-*.png)."

    def handle(self, *args, **opcoes):
        pasta = Path(settings.STATICFILES_DIRS[0])
        # O icone comum encosta nas bordas; o maskable deixa a zona segura de
        # 10% que o Android recorta em circulo, e o da Apple ja vem quadrado.
        for nome, lado, margem in [
            ("icone-192.png", 192, 24),
            ("icone-512.png", 512, 64),
            ("icone-mascara-512.png", 512, 128),
            ("icone-apple-180.png", 180, 22),
        ]:
            png(pasta / nome, lado, margem)
            self.stdout.write(self.style.SUCCESS(f"{nome} ({lado}x{lado})"))
