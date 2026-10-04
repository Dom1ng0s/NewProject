"""Sessão de estudo: duração, interrupções e o atalho vindo do planner."""


from estudos.models import SessaoEstudo

from .base import CasoBase


class CriarSessao(CasoBase):
    def dados(self, **extra):
        base = {"topico_id": self.topico.id, "duracao_min": 50}
        base.update(extra)
        return base

    def test_guarda_as_interrupcoes(self):
        resposta = self.post("/api/sessoes/criar/", self.dados(interrupcoes=3))
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(SessaoEstudo.objects.get().interrupcoes, 3)
        self.assertEqual(resposta.json()["sessao"]["interrupcoes"], 3)

    def test_sem_interrupcoes_e_zero(self):
        self.post("/api/sessoes/criar/", self.dados())
        self.assertEqual(SessaoEstudo.objects.get().interrupcoes, 0)

    def test_numero_negativo_vira_zero(self):
        self.post("/api/sessoes/criar/", self.dados(interrupcoes=-5))
        self.assertEqual(SessaoEstudo.objects.get().interrupcoes, 0)

    def test_valor_absurdo_tem_teto(self):
        self.post("/api/sessoes/criar/", self.dados(interrupcoes=100000))
        self.assertEqual(SessaoEstudo.objects.get().interrupcoes, 999)

    def test_texto_no_lugar_do_numero_e_recusado(self):
        resposta = self.post("/api/sessoes/criar/", self.dados(interrupcoes="muitas"))
        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(SessaoEstudo.objects.count(), 0)

    def test_interrupcoes_aparecem_na_listagem(self):
        self.post("/api/sessoes/criar/", self.dados(interrupcoes=2))
        dados = self.client.get("/api/sessoes/").json()
        self.assertEqual(dados["sessoes"][0]["interrupcoes"], 2)


class ConfiguracaoDoPomodoro(CasoBase):
    def test_a_tela_recebe_os_quatro_ajustes(self):
        contexto = self.client.get("/sessao/").context
        self.assertEqual(contexto["pomodoro_foco"], self.config.pomodoro_foco_min)
        self.assertEqual(contexto["pomodoro_pausa"], self.config.pomodoro_pausa_min)
        self.assertEqual(contexto["pomodoro_pausa_longa"], self.config.pomodoro_pausa_longa_min)
        self.assertEqual(contexto["pomodoro_ciclos"], self.config.pomodoro_ciclos)

    def test_o_html_leva_os_valores_configurados(self):
        self.configurar(pomodoro_foco_min=30, pomodoro_pausa_longa_min=20, pomodoro_ciclos=3)
        html = self.client.get("/sessao/").content.decode()
        self.assertIn('data-foco="30"', html)
        self.assertIn('data-pausa-longa="20"', html)
        self.assertIn('data-ciclos="3"', html)


class AtalhoDoPlanner(CasoBase):
    def test_a_tela_abre_com_os_parametros(self):
        bloco = self.criar_bloco(topico=self.topico)
        resposta = self.client.get(f"/sessao/?topico_id={self.topico.id}&minutos={bloco.duracao_min}")
        self.assertEqual(resposta.status_code, 200)

    def test_o_bloco_informa_topico_e_duracao_para_o_atalho(self):
        bloco = self.criar_bloco(topico=self.topico, inicio="08:00", fim="09:30")
        dados = bloco.json()
        self.assertEqual(dados["topico_id"], self.topico.id)
        self.assertEqual(dados["duracao_min"], 90)

    def test_bloco_sem_topico_nao_tem_do_que_partir(self):
        self.assertIsNone(self.criar_bloco().json()["topico_id"])
