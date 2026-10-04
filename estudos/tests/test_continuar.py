"""O atalho "Continuar" do dashboard: qual tópico o app oferece em um clique."""

from datetime import datetime, time, timedelta

from django.utils import timezone

from estudos.services import continuar_de_onde_parou, dados_dashboard

from .base import CasoBase


def momento(hora, minuto=0, dias=0):
    """Hoje (ou daqui a `dias`) naquele horário, no fuso do app."""
    dia = timezone.localdate() + timedelta(days=dias)
    return timezone.make_aware(datetime.combine(dia, time(hora, minuto)))


class ContinuarDeOndeParou(CasoBase):
    def test_sem_sessao_e_sem_bloco_nao_ha_o_que_continuar(self):
        self.assertIsNone(continuar_de_onde_parou())

    def test_sem_bloco_oferece_o_topico_da_ultima_sessao(self):
        antigo = self.criar_topico("Derivadas")
        self.criar_sessao(dias_atras=3, topico=antigo)
        self.criar_sessao(dias_atras=1, topico=self.topico)

        c = continuar_de_onde_parou()
        self.assertEqual(c["topico_id"], self.topico.id)
        self.assertEqual(c["materia"], self.materia.nome)
        self.assertEqual(c["minutos"], self.config.pomodoro_foco_min)

    def test_o_bloco_de_agora_ganha_da_ultima_sessao(self):
        outro = self.criar_topico("Integrais")
        self.criar_sessao(topico=self.topico)
        agora = momento(9, 0)
        self.criar_bloco(
            dia=agora.weekday(), inicio="08:00", fim="10:00", topico=outro
        )

        c = continuar_de_onde_parou(agora)
        self.assertEqual(c["topico_id"], outro.id)
        self.assertIn("planner", c["motivo"])

    def test_o_foco_sugerido_e_o_que_resta_do_bloco(self):
        self.criar_bloco(dia=momento(9).weekday(), inicio="08:00", fim="10:00",
                         topico=self.topico)
        self.assertEqual(continuar_de_onde_parou(momento(9, 30))["minutos"], 30)

    def test_bloco_quase_no_fim_ainda_sugere_um_foco_curto(self):
        self.criar_bloco(dia=momento(9).weekday(), inicio="08:00", fim="10:00",
                         topico=self.topico)
        self.assertEqual(continuar_de_onde_parou(momento(9, 59))["minutos"], 5)

    def test_bloco_sem_topico_nao_diz_o_que_estudar(self):
        self.criar_sessao(topico=self.topico)
        agora = momento(9)
        self.criar_bloco(dia=agora.weekday(), inicio="08:00", fim="10:00")
        self.assertEqual(continuar_de_onde_parou(agora)["motivo"], "o que você estudou por último")

    def test_bloco_pulado_naquela_semana_nao_vale(self):
        from estudos.models import OcorrenciaPulada
        from estudos.services import segunda_da_semana

        self.criar_sessao(topico=self.topico)
        agora = momento(9)
        outro = self.criar_topico("Integrais")
        bloco = self.criar_bloco(
            dia=agora.weekday(), inicio="08:00", fim="10:00", topico=outro, semana=None
        )
        OcorrenciaPulada.objects.create(bloco=bloco, semana=segunda_da_semana(agora.date()))

        self.assertEqual(continuar_de_onde_parou(agora)["topico_id"], self.topico.id)

    def test_bloco_de_outro_dia_nao_vale_para_hoje(self):
        agora = momento(9)
        self.criar_bloco(
            dia=(agora.weekday() + 1) % 7, inicio="08:00", fim="10:00", topico=self.topico
        )
        self.assertIsNone(continuar_de_onde_parou(agora))

    def test_fora_do_horario_do_bloco_nao_vale(self):
        self.criar_bloco(dia=momento(9).weekday(), inicio="08:00", fim="10:00",
                         topico=self.topico)
        self.assertIsNone(continuar_de_onde_parou(momento(11, 0)))


class ContinuarNoDashboard(CasoBase):
    def test_a_chave_existe_mesmo_sem_nada_para_continuar(self):
        self.assertIn("continuar", dados_dashboard())

    def test_a_api_entrega_o_atalho(self):
        self.criar_sessao(topico=self.topico)
        dados = self.client.get("/api/dashboard/").json()
        self.assertEqual(dados["continuar"]["topico_id"], self.topico.id)

    def test_a_tela_de_sessao_aceita_iniciar(self):
        resposta = self.client.get(f"/sessao/?topico_id={self.topico.id}&minutos=25&iniciar=1")
        self.assertEqual(resposta.status_code, 200)
