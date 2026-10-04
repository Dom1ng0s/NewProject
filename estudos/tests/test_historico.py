"""Histórico: mapa de constância, sequências e tendência por semana."""

from datetime import timedelta

from django.utils import timezone

from estudos.models import Materia, Revisao, Topico
from estudos.services import (
    dados_historico,
    minutos_por_dia,
    nivel_do_dia,
    segunda_da_semana,
    sequencia,
)

from .base import CasoBase


class MinutosPorDia(CasoBase):
    def test_soma_as_sessoes_do_mesmo_dia(self):
        self.criar_sessao(dias_atras=1, minutos=30)
        self.criar_sessao(dias_atras=1, minutos=45)
        por_dia = minutos_por_dia(self.hoje - timedelta(days=7))
        self.assertEqual(por_dia[self.hoje - timedelta(days=1)], 75)

    def test_ignora_o_que_e_mais_antigo_que_o_corte(self):
        self.criar_sessao(dias_atras=40, minutos=60)
        self.assertEqual(minutos_por_dia(self.hoje - timedelta(days=7)), {})

    def test_dia_sem_sessao_nao_aparece(self):
        self.criar_sessao(dias_atras=0, minutos=20)
        self.assertEqual(list(minutos_por_dia(self.hoje - timedelta(days=3))), [self.hoje])


class NivelDoDia(CasoBase):
    def test_dia_vazio_e_nivel_zero(self):
        self.assertEqual(nivel_do_dia(0, 120), 0)

    def test_o_melhor_dia_do_periodo_e_o_nivel_quatro(self):
        self.assertEqual(nivel_do_dia(120, 120), 4)

    def test_a_escala_sobe_junto_com_os_minutos(self):
        niveis = [nivel_do_dia(m, 120) for m in (10, 40, 80, 120)]
        self.assertEqual(niveis, sorted(niveis))
        self.assertEqual(niveis[0], 1)

    def test_sem_teto_qualquer_estudo_e_nivel_um(self):
        self.assertEqual(nivel_do_dia(30, 0), 1)


class Sequencias(CasoBase):
    def dias(self, *offsets):
        return {self.hoje - timedelta(days=d) for d in offsets}

    def test_sem_dias_estudados(self):
        self.assertEqual(sequencia(set(), self.hoje), (0, 0))

    def test_dias_seguidos_terminando_hoje(self):
        self.assertEqual(sequencia(self.dias(0, 1, 2), self.hoje), (3, 3))

    def test_terminar_ontem_ainda_conta(self):
        # O dia de hoje ainda nao acabou; zerar as 00h01 so puniria quem estuda
        # de manha.
        self.assertEqual(sequencia(self.dias(1, 2), self.hoje), (2, 2))

    def test_buraco_de_dois_dias_zera_a_atual(self):
        atual, maior = sequencia(self.dias(3, 4, 5), self.hoje)
        self.assertEqual(atual, 0)
        self.assertEqual(maior, 3)

    def test_maior_sequencia_e_lembrada_mesmo_depois_de_quebrar(self):
        atual, maior = sequencia(self.dias(0, 10, 11, 12, 13), self.hoje)
        self.assertEqual((atual, maior), (1, 4))

    def test_um_dia_so(self):
        self.assertEqual(sequencia(self.dias(0), self.hoje), (1, 1))


class MapaDoHistorico(CasoBase):
    def test_comeca_numa_segunda_e_termina_hoje(self):
        dados = dados_historico(dias=30)
        self.assertEqual(dados["mapa"][0]["dia_semana"], 0)
        self.assertEqual(dados["mapa"][-1]["data"], self.hoje.isoformat())
        self.assertEqual(dados["desde"], dados["mapa"][0]["data"])

    def test_todo_dia_do_periodo_tem_um_quadrado(self):
        dados = dados_historico(dias=30)
        datas = [d["data"] for d in dados["mapa"]]
        self.assertEqual(len(datas), len(set(datas)))
        self.assertEqual(len(datas), dados["dias_no_periodo"])

    def test_o_dia_com_sessao_fica_aceso(self):
        self.criar_sessao(dias_atras=2, minutos=60)
        dados = dados_historico(dias=30)
        dia = next(
            d
            for d in dados["mapa"]
            if d["data"] == (self.hoje - timedelta(days=2)).isoformat()
        )
        self.assertEqual(dia["minutos"], 60)
        self.assertGreater(dia["nivel"], 0)

    def test_resumo_do_periodo(self):
        self.criar_sessao(dias_atras=0, minutos=60)
        self.criar_sessao(dias_atras=1, minutos=120)
        dados = dados_historico(dias=30)
        self.assertEqual(dados["total_horas"], 3.0)
        self.assertEqual(dados["dias_ativos"], 2)
        self.assertEqual(dados["media_por_dia_ativo"], 1.5)
        self.assertEqual(dados["sequencia_atual"], 2)

    def test_banco_vazio_nao_quebra(self):
        dados = dados_historico(dias=30)
        self.assertEqual(dados["total_horas"], 0)
        self.assertEqual(dados["media_por_dia_ativo"], 0)
        self.assertEqual(dados["sequencia_atual"], 0)
        self.assertEqual(dados["topicos"], [])


class TendenciaSemanal(CasoBase):
    def test_sempre_doze_semanas_terminando_na_atual(self):
        semanas = dados_historico()["semanas"]
        self.assertEqual(len(semanas), 12)
        self.assertEqual(semanas[-1]["semana"], segunda_da_semana(self.hoje).isoformat())

    def test_as_horas_caem_na_semana_certa(self):
        self.criar_sessao(dias_atras=0, minutos=90)
        semanas = dados_historico()["semanas"]
        self.assertEqual(semanas[-1]["horas"], 1.5)
        self.assertEqual(sum(s["horas"] for s in semanas[:-1]), 0)

    def test_conta_as_revisoes_fechadas_na_semana(self):
        Revisao.objects.create(
            topico=self.topico,
            data_prevista=self.hoje,
            feita=True,
            feita_em=timezone.now(),
        )
        self.assertEqual(dados_historico()["semanas"][-1]["revisoes"], 1)

    def test_revisao_pendente_nao_conta(self):
        Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        self.assertEqual(dados_historico()["semanas"][-1]["revisoes"], 0)


class TopicosComMaisTempo(CasoBase):
    def test_ordena_do_maior_para_o_menor(self):
        outro = self.criar_topico("Derivadas")
        self.criar_sessao(minutos=30, topico=self.topico)
        self.criar_sessao(minutos=120, topico=outro)
        topicos = dados_historico()["topicos"]
        self.assertEqual([t["topico"] for t in topicos], ["Derivadas", "Limites"])
        self.assertEqual(topicos[0]["horas"], 2.0)

    def test_traz_a_materia_e_a_cor(self):
        self.criar_sessao(minutos=30)
        topico = dados_historico()["topicos"][0]
        self.assertEqual(topico["materia"], "Cálculo")
        self.assertEqual(topico["cor"], "#112233")

    def test_no_maximo_dez(self):
        for i in range(12):
            self.criar_sessao(minutos=10, topico=self.criar_topico(f"T{i}"))
        self.assertEqual(len(dados_historico()["topicos"]), 10)

    def test_topicos_de_materias_diferentes_convivem(self):
        outra = Materia.objects.create(nome="Física")
        self.criar_sessao(minutos=60, topico=Topico.objects.create(materia=outra, nome="Ondas"))
        self.criar_sessao(minutos=30, topico=self.topico)
        self.assertEqual(
            [t["materia"] for t in dados_historico()["topicos"]], ["Física", "Cálculo"]
        )


class PelaApi(CasoBase):
    def test_tela_abre(self):
        self.assertEqual(self.client.get("/historico/").status_code, 200)

    def test_api_responde_com_o_mapa(self):
        self.criar_sessao(minutos=45)
        dados = self.client.get("/api/historico/").json()
        self.assertEqual(dados["hoje"], self.hoje.isoformat())
        self.assertEqual(dados["total_horas"], 0.8)
        self.assertTrue(dados["mapa"])

    def test_api_nao_aceita_post(self):
        self.assertEqual(self.client.post("/api/historico/").status_code, 405)
