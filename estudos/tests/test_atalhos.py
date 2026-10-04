"""Atalhos de teclado: o acorde `g` não pode levar a uma tela que não existe."""

import re
from pathlib import Path

from django.conf import settings

from .base import CasoBase

COMUM_JS = Path(settings.BASE_DIR) / "static" / "js" / "comum.js"


def destinos_do_acorde():
    """As rotas da tabela IR_PARA do comum.js, lidas do próprio arquivo."""
    fonte = COMUM_JS.read_text(encoding="utf-8")
    bloco = re.search(r"const IR_PARA = \[(.*?)\];", fonte, re.S)
    assert bloco, "IR_PARA saiu do comum.js"
    return re.findall(r"\['(.)', '([^']+)', '([^']+)'\]", bloco.group(1))


class AcordeIrPara(CasoBase):
    def test_a_tabela_nao_esta_vazia(self):
        self.assertGreaterEqual(len(destinos_do_acorde()), 8)

    def test_toda_rota_do_acorde_responde(self):
        for tecla, rota, nome in destinos_do_acorde():
            with self.subTest(tecla=tecla, rota=rota):
                self.assertEqual(self.client.get(rota).status_code, 200, nome)

    def test_nenhuma_letra_repetida(self):
        teclas = [t for t, _, _ in destinos_do_acorde()]
        self.assertEqual(len(teclas), len(set(teclas)))

    def test_as_telas_do_menu_estao_todas_no_acorde(self):
        rotas = {rota for _, rota, _ in destinos_do_acorde()}
        html = self.client.get("/").content.decode()
        # Toda tela que o menu lateral oferece tem de ter atalho também.
        do_menu = set(re.findall(r'<a href="(/[a-z]*/?)"', html))
        self.assertTrue(do_menu <= rotas, do_menu - rotas)
