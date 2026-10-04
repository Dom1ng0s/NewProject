"""Servir na rede local: revisar do celular tem de funcionar sem truque."""

from .base import CasoBase

TELAS = ["/", "/revisar/", "/sessao/", "/materias/", "/planner/", "/avaliacoes/"]


class AcessoPeloIpDaRede(CasoBase):
    """O celular chega pelo IP da máquina, não por 127.0.0.1."""

    def test_as_telas_respondem_com_host_de_rede_local(self):
        for tela in TELAS:
            with self.subTest(tela=tela):
                resposta = self.client.get(tela, headers={"host": "192.168.0.14:8000"})
                self.assertEqual(resposta.status_code, 200)

    def test_a_api_da_fila_responde_com_host_de_rede_local(self):
        resposta = self.client.get(
            "/api/revisoes/hoje/", headers={"host": "192.168.0.14:8000"}
        )
        self.assertEqual(resposta.status_code, 200)

    def test_o_nome_da_maquina_tambem_serve(self):
        resposta = self.client.get("/revisar/", headers={"host": "notebook.local:8000"})
        self.assertEqual(resposta.status_code, 200)

    def test_a_tela_declara_viewport_para_o_celular(self):
        html = self.client.get("/revisar/").content.decode()
        self.assertIn('name="viewport"', html)
        self.assertIn("width=device-width", html)
