"""O log de respostas: cada nota dada numa revisão vira uma linha que fica."""

from estudos.models import RespostaRevisao, Revisao, Topico
from estudos.services import registrar_resposta

from .base import CasoBase


class GravarOLog(CasoBase):
    def revisar(self, resposta="bom", topico=None):
        topico = topico or self.topico
        revisao = Revisao.objects.create(topico=topico, data_prevista=self.hoje)
        return self.post(f"/api/revisoes/{revisao.id}/responder/", {"resposta": resposta})

    def test_responder_grava_uma_linha(self):
        self.revisar()
        self.assertEqual(RespostaRevisao.objects.count(), 1)

    def test_a_linha_guarda_a_nota_na_escala_do_sm2(self):
        self.revisar("facil")
        self.assertEqual(RespostaRevisao.objects.get().qualidade, 5)

    def test_guarda_o_estado_de_antes_e_de_depois(self):
        self.revisar("bom")
        log = RespostaRevisao.objects.get()
        self.assertEqual(log.facilidade_antes, 2.5)
        self.assertEqual(log.intervalo_antes, 0)
        self.assertEqual(log.acertos_antes, 0)
        self.assertEqual(log.intervalo_depois, self.config.primeiro_intervalo_dias)
        self.assertEqual(log.status_antes, Topico.NAO_INICIADO)

    def test_tres_revisoes_viram_tres_linhas(self):
        for _ in range(3):
            Revisao.objects.filter(feita=False).delete()
            self.revisar()
        self.assertEqual(RespostaRevisao.objects.count(), 3)

    def test_a_linha_aponta_para_a_revisao_fechada(self):
        self.revisar()
        log = RespostaRevisao.objects.get()
        self.assertTrue(log.revisao.feita)

    def test_errar_e_acertar_ficam_distinguiveis(self):
        self.revisar("errei")
        self.assertFalse(RespostaRevisao.objects.get().acertou)
        Revisao.objects.filter(feita=False).delete()
        self.revisar("bom")
        self.assertTrue(RespostaRevisao.objects.latest("id").acertou)

    def test_o_atraso_e_contado_em_dias(self):
        from datetime import timedelta

        revisao = Revisao.objects.create(
            topico=self.topico, data_prevista=self.hoje - timedelta(days=4)
        )
        registrar_resposta(revisao, 4)
        self.assertEqual(RespostaRevisao.objects.get().atraso_dias, 4)

    def test_revisao_em_dia_nao_tem_atraso(self):
        revisao = Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        registrar_resposta(revisao, 4)
        self.assertEqual(RespostaRevisao.objects.get().atraso_dias, 0)

    def test_revisao_respondida_antes_do_previsto_nao_tem_atraso_negativo(self):
        from datetime import timedelta

        revisao = Revisao.objects.create(
            topico=self.topico, data_prevista=self.hoje + timedelta(days=3)
        )
        registrar_resposta(revisao, 4)
        self.assertEqual(RespostaRevisao.objects.get().atraso_dias, 0)

    def test_apagar_a_revisao_nao_apaga_o_log(self):
        self.revisar()
        Revisao.objects.all().delete()
        log = RespostaRevisao.objects.get()
        self.assertIsNone(log.revisao)

    def test_apagar_o_topico_leva_o_log(self):
        self.revisar()
        self.topico.delete()
        self.assertEqual(RespostaRevisao.objects.count(), 0)

    def test_a_resposta_da_api_devolve_o_id_do_log(self):
        dados = self.revisar().json()
        self.assertEqual(dados["resposta_id"], RespostaRevisao.objects.get().id)

    def test_o_json_do_log_tem_o_que_a_tela_precisa(self):
        self.revisar("dificil")
        dados = RespostaRevisao.objects.get().json()
        self.assertEqual(dados["topico"], self.topico.nome)
        self.assertEqual(dados["materia"], self.materia.nome)
        self.assertEqual(dados["qualidade"], 3)
        self.assertTrue(dados["acertou"])
