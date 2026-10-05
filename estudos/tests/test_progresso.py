"""A fila do dia como coisa que fecha.

A conta tem uma regra só, e é dela que sai o resto: o que passou do teto não
entra no denominador. Um progresso que nunca chega a 100% é uma dívida, e a
tela inteira foi mudada para parar de mostrar uma.
"""

from datetime import timedelta

from django.utils import timezone

from estudos.models import Revisao
from estudos.services import progresso_do_dia, restantes_do_dia

from .base import CasoBase


class RestantesDoDia(CasoBase):
    def test_conta_as_de_hoje_e_as_atrasadas(self):
        Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        outro = self.criar_topico("Derivadas")
        Revisao.objects.create(
            topico=outro, data_prevista=self.hoje - timedelta(days=3)
        )
        self.assertEqual(restantes_do_dia(), 2)

    def test_a_de_amanha_nao_e_de_hoje(self):
        Revisao.objects.create(
            topico=self.topico, data_prevista=self.hoje + timedelta(days=1)
        )
        self.assertEqual(restantes_do_dia(), 0)

    def test_o_teto_corta_a_conta(self):
        self.configurar(maximo_revisoes_por_dia=2)
        for i in range(5):
            Revisao.objects.create(
                topico=self.criar_topico(f"T{i}"), data_prevista=self.hoje
            )
        self.assertEqual(restantes_do_dia(), 2)

    def test_sem_teto_todas_contam(self):
        self.configurar(maximo_revisoes_por_dia=0)
        for i in range(5):
            Revisao.objects.create(
                topico=self.criar_topico(f"T{i}"), data_prevista=self.hoje
            )
        self.assertEqual(restantes_do_dia(), 5)


class ProgressoDoDia(CasoBase):
    def responder(self, quando=None):
        Revisao.objects.create(
            topico=self.topico,
            data_prevista=self.hoje,
            feita=True,
            feita_em=quando or timezone.now(),
        )

    def test_dia_sem_nada_ja_esta_cumprido(self):
        p = progresso_do_dia(0)
        self.assertEqual(p["percentual"], 100)
        self.assertTrue(p["zerada"])
        # Zerada sim, mas nao houve nada para fechar: nada a comemorar.
        self.assertFalse(p["fechou_agora"])

    def test_metade_da_fila(self):
        self.responder()
        self.responder()
        p = progresso_do_dia(2)
        self.assertEqual((p["feitas"], p["restantes"], p["total"]), (2, 2, 4))
        self.assertEqual(p["percentual"], 50)
        self.assertFalse(p["zerada"])

    def test_fechar_a_fila_e_um_momento_que_a_tela_reconhece(self):
        self.responder()
        p = progresso_do_dia(0)
        self.assertEqual(p["percentual"], 100)
        self.assertTrue(p["fechou_agora"])

    def test_a_revisao_de_ontem_nao_entra_no_dia_de_hoje(self):
        self.responder(timezone.now() - timedelta(days=1))
        self.assertEqual(progresso_do_dia(1)["feitas"], 0)

    def test_o_excedente_do_teto_fica_fora_da_conta(self):
        """A dívida não pode entrar no denominador: é o que faz 100% existir."""
        self.configurar(maximo_revisoes_por_dia=3)
        for i in range(10):
            Revisao.objects.create(
                topico=self.criar_topico(f"T{i}"), data_prevista=self.hoje
            )
        p = progresso_do_dia(restantes_do_dia())
        self.assertEqual(p["total"], 3)
        self.assertEqual(p["percentual"], 0)


class PelaApi(CasoBase):
    def test_a_fila_de_hoje_traz_o_progresso_e_a_sequencia(self):
        dados = self.client.get("/api/revisoes/hoje/").json()
        self.assertIn("progresso", dados)
        self.assertIn("percentual", dados["progresso"])
        self.assertIn("sequencia", dados)

    def test_o_dashboard_traz_o_progresso(self):
        Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        dados = self.client.get("/api/dashboard/").json()
        self.assertEqual(dados["progresso"]["restantes"], 1)
        self.assertEqual(dados["progresso"]["percentual"], 0)

    def test_responder_devolve_o_progresso_de_depois(self):
        revisao = Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        saida = self.post(f"/api/revisoes/{revisao.id}/responder/", {"resposta": "bom"})
        progresso = saida.json()["progresso"]
        self.assertEqual(progresso["feitas"], 1)
        self.assertTrue(progresso["fechou_agora"])


class ODenominadorNaoSeMove(CasoBase):
    """O alvo do dia é fixo: responder não pode puxar outra do atraso para o lugar.

    Era o defeito que a tela tinha antes de ter anel: com fila maior que o
    teto, cada resposta subia uma atrasada e o total crescia junto -- 2/12
    virava 3/13. Progresso que persegue o próprio alvo é dívida com outro nome.
    """

    def encher(self, quantas):
        for i in range(quantas):
            Revisao.objects.create(
                topico=self.criar_topico(f"T{i}"),
                data_prevista=self.hoje - timedelta(days=1),
            )

    def responder_uma(self):
        pendente = Revisao.objects.filter(feita=False).first()
        self.post(f"/api/revisoes/{pendente.id}/responder/", {"resposta": "bom"})

    def test_o_total_do_dia_nao_cresce_a_cada_resposta(self):
        self.configurar(maximo_revisoes_por_dia=5)
        self.encher(20)

        totais = []
        for _ in range(4):
            dados = self.client.get("/api/revisoes/hoje/").json()
            totais.append(dados["progresso"]["total"])
            self.responder_uma()

        self.assertEqual(totais, [5, 5, 5, 5])

    def test_o_dia_fecha_ao_cumprir_o_teto(self):
        self.configurar(maximo_revisoes_por_dia=3)
        self.encher(20)
        for _ in range(3):
            self.responder_uma()

        dados = self.client.get("/api/revisoes/hoje/").json()
        self.assertEqual(dados["progresso"]["percentual"], 100)
        self.assertEqual(dados["fila"], [])
        # O resto nao sumiu: continua dito, fora da manchete.
        self.assertEqual(dados["esperando"], 17)

    def test_sem_teto_o_total_e_a_fila_inteira(self):
        self.configurar(maximo_revisoes_por_dia=0)
        self.encher(4)
        self.responder_uma()
        progresso = self.client.get("/api/revisoes/hoje/").json()["progresso"]
        self.assertEqual((progresso["feitas"], progresso["total"]), (1, 4))
