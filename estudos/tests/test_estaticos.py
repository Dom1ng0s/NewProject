"""A URL do estático muda quando o arquivo muda — inclusive o que ele importa."""

import os
import re
import tempfile
from pathlib import Path

from django.test import override_settings

from estudos.templatetags.estaticos import estatico

from .base import CasoBase

PASTA = tempfile.mkdtemp()


def escrever(nome, texto, quando):
    caminho = Path(PASTA) / nome
    caminho.write_text(texto, encoding="utf-8")
    os.utime(caminho, (quando, quando))
    return caminho


@override_settings(STATICFILES_DIRS=[PASTA])
class VersaoDoEstatico(CasoBase):
    def versao(self, caminho):
        return int(estatico(caminho).split("?v=")[1])

    def test_usa_a_data_do_proprio_arquivo(self):
        escrever("sozinho.js", "// nada", 1_000_000)
        self.assertEqual(self.versao("sozinho.js"), 1_000_000)

    def test_css_de_entrada_herda_a_data_do_importado(self):
        # O arquivo de entrada é antigo; quem mudou foi o importado.
        escrever("filho.css", ".a { color: red }", 2_000_000)
        escrever("entrada.css", '@import url("filho.css");', 1_000_000)
        self.assertEqual(self.versao("entrada.css"), 2_000_000)

    def test_importe_em_cadeia(self):
        escrever("neto.css", ".c {}", 3_000_000)
        escrever("filho.css", '@import url("neto.css");', 1_500_000)
        escrever("entrada.css", '@import url("filho.css");', 1_000_000)
        self.assertEqual(self.versao("entrada.css"), 3_000_000)

    def test_importe_circular_nao_trava(self):
        escrever("a.css", '@import url("b.css");', 1_000_000)
        escrever("b.css", '@import url("a.css");', 2_000_000)
        self.assertEqual(self.versao("a.css"), 2_000_000)

    def test_importe_externo_e_ignorado(self):
        escrever("entrada.css", '@import url("https://fonts.googleapis.com/x.css");', 1_000_000)
        self.assertEqual(self.versao("entrada.css"), 1_000_000)

    def test_importe_que_nao_existe_nao_quebra(self):
        escrever("entrada.css", '@import url("sumiu.css");', 1_000_000)
        self.assertEqual(self.versao("entrada.css"), 1_000_000)

    def test_arquivo_inexistente_sai_sem_versao(self):
        self.assertNotIn("?v=", estatico("nao-existe.js"))

    def test_aspas_simples_tambem_valem(self):
        escrever("filho.css", ".a {}", 2_500_000)
        escrever("entrada.css", "@import 'filho.css';", 1_000_000)
        self.assertEqual(self.versao("entrada.css"), 2_500_000)


def versao_do_css(html):
    """O ?v= que a página mandou o navegador buscar."""
    achado = re.search(r"css/estilo\.css\?v=(\d+)", html)
    return achado and achado.group(1)


class PaginaNuncaFicaEmCache(CasoBase):
    """O ?v= protege o CSS; quem carregava o ?v= velho era a página guardada."""

    def test_o_html_pede_para_nao_ser_guardado(self):
        for tela in ("/", "/revisar/", "/materias/", "/planner/"):
            with self.subTest(tela=tela):
                resposta = self.client.get(tela)
                self.assertEqual(resposta["Cache-Control"], "no-store")

    def test_a_api_nao_e_html_e_fica_de_fora(self):
        self.assertNotIn("Cache-Control", self.client.get("/api/dashboard/"))

    def test_a_pagina_aponta_para_a_versao_de_agora_do_css(self):
        """Era isto que uma página guardada quebrava: o ?v= ficava no passado."""
        html = self.client.get("/").content.decode()
        atual = estatico("css/estilo.css").split("=")[-1]
        self.assertEqual(versao_do_css(html), atual)
