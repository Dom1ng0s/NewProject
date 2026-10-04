"""Carga futura: a dívida que o SM-2 cria e o aviso de colisão com a prova."""

from datetime import timedelta

from estudos.models import Avaliacao, Revisao
from estudos.services import DIAS_DA_CARGA, carga_futura

from .base import CasoBase


class GradeDaCarga(CasoBase):
    def marcar(self, dias, topico=None):
        return Revisao.objects.create(
            topico=topico or self.criar_topico(f"Tópico {dias}-{Revisao.objects.count()}"),
            data_prevista=self.hoje + timedelta(days=dias),
        )

    def test_a_grade_cobre_quatro_semanas_a_partir_de_hoje(self):
        d = carga_futura()
        self.assertEqual(len(d["dias"]), DIAS_DA_CARGA)
        self.assertEqual(d["dias"][0]["data"], self.hoje.isoformat())

    def test_conta_as_revisoes_de_cada_dia(self):
        self.marcar(3)
        self.marcar(3)
        self.marcar(10)
        d = carga_futura()
        self.assertEqual(d["dias"][3]["revisoes"], 2)
        self.assertEqual(d["dias"][10]["revisoes"], 1)
        self.assertEqual(d["total"], 3)
        self.assertEqual(d["pico"], 2)

    def test_atrasada_pesa_hoje(self):
        self.marcar(-5)
        self.assertEqual(carga_futura()["dias"][0]["revisoes"], 1)

    def test_revisao_feita_nao_pesa(self):
        revisao = self.marcar(2)
        revisao.feita = True
        revisao.save()
        self.assertEqual(carga_futura()["total"], 0)

    def test_fora_do_horizonte_nao_entra(self):
        self.marcar(DIAS_DA_CARGA + 5)
        self.assertEqual(carga_futura()["total"], 0)

    def test_dia_no_teto_vem_marcado_como_cheio(self):
        self.configurar(maximo_revisoes_por_dia=2)
        self.marcar(4)
        self.marcar(4)
        d = carga_futura()
        self.assertTrue(d["dias"][4]["cheio"])
        self.assertFalse(d["dias"][5]["cheio"])

    def test_sem_teto_nenhum_dia_fica_cheio(self):
        self.configurar(maximo_revisoes_por_dia=0)
        for _ in range(30):
            self.marcar(4)
        self.assertFalse(any(d["cheio"] for d in carga_futura()["dias"]))

    def test_a_prova_aparece_no_dia_dela(self):
        Avaliacao.objects.create(
            materia=self.materia, titulo="P1", data=self.hoje + timedelta(days=6)
        )
        self.assertEqual(carga_futura()["dias"][6]["provas"], ["P1"])

    def test_prova_concluida_nao_aparece(self):
        Avaliacao.objects.create(
            materia=self.materia,
            titulo="P1",
            data=self.hoje + timedelta(days=6),
            concluida=True,
        )
        self.assertEqual(carga_futura()["dias"][6]["provas"], [])

    def test_a_api_entrega_a_grade(self):
        self.marcar(1)
        dados = self.client.get("/api/carga/").json()
        self.assertEqual(len(dados["dias"]), DIAS_DA_CARGA)
        self.assertEqual(dados["total"], 1)


class AlertaDeColisao(CasoBase):
    def marcar(self, dias):
        Revisao.objects.create(
            topico=self.criar_topico(f"T{dias}-{Revisao.objects.count()}"),
            data_prevista=self.hoje + timedelta(days=dias),
        )

    def prova(self, dias, titulo="P1"):
        return Avaliacao.objects.create(
            materia=self.materia, titulo=titulo, data=self.hoje + timedelta(days=dias)
        )

    def test_semana_que_cabe_nao_gera_alerta(self):
        self.configurar(maximo_revisoes_por_dia=10)
        self.prova(10)
        for _ in range(5):
            self.marcar(8)
        self.assertEqual(carga_futura()["alertas"], [])

    def test_semana_estourada_gera_alerta_com_o_excedente(self):
        self.configurar(maximo_revisoes_por_dia=2)  # capacidade 14 na semana
        self.prova(10)
        for dia in (7, 8, 9, 10):
            for _ in range(4):
                self.marcar(dia)

        alerta = carga_futura()["alertas"][0]
        self.assertEqual(alerta["titulo"], "P1")
        self.assertEqual(alerta["revisoes_na_semana"], 16)
        self.assertEqual(alerta["capacidade"], 14)
        self.assertEqual(alerta["excedente"], 2)

    def test_revisao_depois_da_prova_nao_conta_na_semana_dela(self):
        self.configurar(maximo_revisoes_por_dia=1)  # capacidade 7
        self.prova(8)
        for _ in range(10):
            self.marcar(12)
        self.assertEqual(carga_futura()["alertas"], [])

    def test_sem_teto_nao_ha_capacidade_para_estourar(self):
        self.configurar(maximo_revisoes_por_dia=0)
        self.prova(5)
        for _ in range(40):
            self.marcar(4)
        self.assertEqual(carga_futura()["alertas"], [])

    def test_duas_provas_no_mesmo_dia_recebem_o_mesmo_aviso(self):
        self.configurar(maximo_revisoes_por_dia=1)
        self.prova(5, "P1")
        self.prova(5, "Entrega")
        for _ in range(10):
            self.marcar(4)
        titulos = [a["titulo"] for a in carga_futura()["alertas"]]
        self.assertEqual(sorted(titulos), ["Entrega", "P1"])
