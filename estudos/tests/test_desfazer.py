"""Desfazer a última nota: a escada do SM-2 volta ao degrau de antes."""

from datetime import timedelta

from estudos.models import RespostaRevisao, Revisao, Topico
from estudos.services import (
    NadaParaDesfazer,
    desfazer_ultima_resposta,
    registrar_resposta,
    ultima_resposta,
)

from .base import CasoBase


class Desfazer(CasoBase):
    def responder(self, qualidade, topico=None, data=None):
        revisao = Revisao.objects.create(
            topico=topico or self.topico, data_prevista=data or self.hoje
        )
        return registrar_resposta(revisao, qualidade)

    def test_sem_resposta_nenhuma_nao_ha_o_que_desfazer(self):
        with self.assertRaises(NadaParaDesfazer):
            desfazer_ultima_resposta()

    def test_devolve_a_facilidade_e_o_intervalo(self):
        self.topico.facilidade = 2.5
        self.topico.intervalo_dias = 6
        self.topico.acertos_seguidos = 2
        self.topico.save()

        self.responder(0)  # errei: derruba tudo
        self.topico.refresh_from_db()
        self.assertEqual(self.topico.acertos_seguidos, 0)

        desfazer_ultima_resposta()
        self.topico.refresh_from_db()
        self.assertEqual(self.topico.facilidade, 2.5)
        self.assertEqual(self.topico.intervalo_dias, 6)
        self.assertEqual(self.topico.acertos_seguidos, 2)

    def test_devolve_o_status(self):
        self.responder(5)
        self.topico.refresh_from_db()
        self.assertEqual(self.topico.status, Topico.REVISADO)

        desfazer_ultima_resposta()
        self.topico.refresh_from_db()
        self.assertEqual(self.topico.status, Topico.NAO_INICIADO)

    def test_a_revisao_volta_para_a_fila_no_dia_em_que_estava(self):
        log, _ = self.responder(4)
        desfazer_ultima_resposta()
        revisao = Revisao.objects.get(pk=log.revisao_id)
        self.assertFalse(revisao.feita)
        self.assertIsNone(revisao.qualidade)
        self.assertIsNone(revisao.feita_em)
        self.assertEqual(revisao.data_prevista, self.hoje)

    def test_a_revisao_que_a_resposta_agendou_desaparece(self):
        self.responder(4)
        self.assertEqual(Revisao.objects.filter(feita=False).count(), 1)
        desfazer_ultima_resposta()
        # Só a que voltou para a fila, nenhuma marcada para o futuro.
        pendentes = Revisao.objects.filter(feita=False)
        self.assertEqual(pendentes.count(), 1)
        self.assertEqual(pendentes.get().data_prevista, self.hoje)

    def test_o_log_perde_a_linha_desfeita(self):
        self.responder(4)
        desfazer_ultima_resposta()
        self.assertEqual(RespostaRevisao.objects.count(), 0)

    def test_desfaz_so_a_mais_recente(self):
        outro = self.criar_topico("Derivadas")
        primeira, _ = self.responder(5)
        primeira.respondida_em -= timedelta(minutes=10)
        primeira.save(update_fields=["respondida_em"])
        self.responder(0, topico=outro)

        d = desfazer_ultima_resposta()
        self.assertEqual(d["topico_id"], outro.id)
        self.assertEqual(RespostaRevisao.objects.get().id, primeira.id)

    def test_desfazer_duas_vezes_desfaz_a_anterior(self):
        primeira, _ = self.responder(5)
        primeira.respondida_em -= timedelta(minutes=10)
        primeira.save(update_fields=["respondida_em"])
        Revisao.objects.filter(feita=False).delete()
        self.responder(5)

        desfazer_ultima_resposta()
        desfazer_ultima_resposta()
        self.assertEqual(RespostaRevisao.objects.count(), 0)
        self.topico.refresh_from_db()
        self.assertEqual(self.topico.acertos_seguidos, 0)

    def test_revisao_apagada_depois_ganha_uma_nova_no_lugar(self):
        log, _ = self.responder(4)
        Revisao.objects.all().delete()
        desfazer_ultima_resposta()
        revisao = Revisao.objects.get()
        self.assertFalse(revisao.feita)
        self.assertEqual(revisao.data_prevista, log.data_prevista)

    def test_errar_depois_de_acertar_tres_vezes_e_reversivel(self):
        """O caso que dói: a escada estava alta e um toque errado a zerou."""
        for _ in range(3):
            Revisao.objects.filter(feita=False).delete()
            resposta, _ = self.responder(4)
            resposta.respondida_em -= timedelta(minutes=1)
            resposta.save(update_fields=["respondida_em"])
        self.topico.refresh_from_db()
        alto = (self.topico.facilidade, self.topico.intervalo_dias, self.topico.acertos_seguidos)

        Revisao.objects.filter(feita=False).delete()
        self.responder(0)
        desfazer_ultima_resposta()
        self.topico.refresh_from_db()
        self.assertEqual(
            (self.topico.facilidade, self.topico.intervalo_dias, self.topico.acertos_seguidos),
            alto,
        )


class DesfazerPelaApi(CasoBase):
    def responder(self, resposta="errei"):
        revisao = Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        return self.post(f"/api/revisoes/{revisao.id}/responder/", {"resposta": resposta})

    def test_sem_resposta_a_api_recusa_com_mensagem(self):
        resposta = self.post("/api/revisoes/desfazer/")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("erro", resposta.json())

    def test_desfaz_e_diz_qual_topico_voltou(self):
        self.responder()
        dados = self.post("/api/revisoes/desfazer/").json()
        self.assertEqual(dados["topico"], self.topico.nome)
        self.assertEqual(dados["qualidade"], 0)

    def test_a_fila_de_hoje_informa_o_que_seria_desfeito(self):
        self.assertIsNone(self.client.get("/api/revisoes/hoje/").json()["ultima_resposta"])
        self.responder("bom")
        ultima = self.client.get("/api/revisoes/hoje/").json()["ultima_resposta"]
        self.assertEqual(ultima["topico"], self.topico.nome)
        self.assertEqual(ultima["qualidade"], 4)

    def test_o_helper_e_a_api_concordam(self):
        self.responder()
        self.assertEqual(
            ultima_resposta()["id"],
            self.client.get("/api/revisoes/hoje/").json()["ultima_resposta"]["id"],
        )

    def test_o_topico_volta_para_a_fila_de_hoje(self):
        self.responder("errei")
        self.post("/api/revisoes/desfazer/")
        fila = self.client.get("/api/revisoes/hoje/").json()["fila"]
        self.assertEqual([r["topico"] for r in fila], [self.topico.nome])

    def test_get_nao_desfaz_nada(self):
        self.responder()
        self.assertEqual(self.client.get("/api/revisoes/desfazer/").status_code, 405)
        self.assertEqual(RespostaRevisao.objects.count(), 1)
