"""A sequência que sobrevive a uma semana de prova.

Zerar a contagem por um dia perdido é o jeito mais rápido de transformar uma
sequência em algo que ninguém recomeça -- e quem perde o dia costuma ser quem
estudou mais naquela semana, não menos. Daí a folga, e daí a manchete ter
virado semanas na meta: a semana é a menor unidade em que a grade se compensa.
"""

from datetime import timedelta

from estudos.services import (
    folgas_restantes,
    semanas_na_meta,
    sequencia,
    segunda_da_semana,
)

from .base import CasoBase


class SequenciaComFolga(CasoBase):
    def dias(self, *offsets):
        return {self.hoje - timedelta(days=d) for d in offsets}

    def test_um_dia_perdido_nao_zera_tudo(self):
        # Estudou hoje e anteontem; ontem passou em branco.
        self.assertEqual(sequencia(self.dias(0, 2), self.hoje, folgas=1), (2, 2))

    def test_dois_dias_perdidos_na_mesma_semana_quebram(self):
        atual, _ = sequencia(self.dias(0, 2, 4), self.hoje, folgas=1)
        self.assertEqual(atual, 1)

    def test_a_folga_se_renova_depois_de_uma_semana(self):
        # Um buraco agora e outro ha nove dias: janelas diferentes, os dois cabem.
        atual, _ = sequencia(self.dias(0, 2, 3, 4, 5, 6, 7, 8, 10), self.hoje, folgas=1)
        self.assertEqual(atual, 9)

    def test_sem_folga_a_regra_antiga_volta(self):
        self.assertEqual(sequencia(self.dias(0, 2), self.hoje, folgas=0), (1, 1))

    def test_a_folga_tambem_perdoa_o_buraco_do_fim(self):
        # Estudou anteontem, nao estudou ontem, hoje ainda nao acabou.
        self.assertEqual(sequencia(self.dias(2, 3), self.hoje, folgas=1), (2, 2))

    def test_buraco_grande_continua_zerando(self):
        atual, maior = sequencia(self.dias(5, 6, 7), self.hoje, folgas=1)
        self.assertEqual((atual, maior), (0, 3))

    def test_a_maior_sequencia_usa_a_mesma_regra(self):
        # Duas contas com dois criterios seriam dois numeros inexplicaveis.
        _, maior = sequencia(self.dias(20, 21, 23, 24), self.hoje, folgas=1)
        self.assertEqual(maior, 4)

    def test_a_config_manda_quando_ninguem_passa_folgas(self):
        self.configurar(folgas_por_semana=0)
        self.assertEqual(sequencia(self.dias(0, 2), self.hoje), (1, 1))


class FolgasRestantes(CasoBase):
    def dias(self, *offsets):
        return {self.hoje - timedelta(days=d) for d in offsets}

    def test_semana_cheia_mantem_a_folga(self):
        estudados = self.dias(*range(0, 8))
        self.assertEqual(folgas_restantes(estudados, self.hoje, 1), 1)

    def test_um_dia_perdido_gasta_a_folga(self):
        estudados = self.dias(0, 1, 3, 4, 5, 6)
        self.assertEqual(folgas_restantes(estudados, self.hoje, 1), 0)

    def test_nunca_fica_negativa(self):
        self.assertEqual(folgas_restantes(set(), self.hoje, 1), 0)

    def test_hoje_nao_conta_como_perdido(self):
        """O dia não acabou: contá-lo como perdido é o aviso que faz desistir dele."""
        estudados = self.dias(1, 2, 3, 4, 5, 6)
        self.assertEqual(folgas_restantes(estudados, self.hoje, 1), 1)


class SemanasNaMeta(CasoBase):
    def semana(self, atras):
        return segunda_da_semana(self.hoje) - timedelta(weeks=atras)

    def por_dia(self, **horas_por_semana):
        """{'0': 10, '1': 12} -> minutos no primeiro dia de cada semana."""
        return {
            self.semana(int(atras)): round(horas * 60)
            for atras, horas in horas_por_semana.items()
        }

    def test_sem_meta_nao_ha_o_que_contar(self):
        self.assertEqual(semanas_na_meta(self.por_dia(**{"0": 20}), self.hoje, 0), (0, 0))

    def test_semanas_seguidas_batendo_a_meta(self):
        dados = self.por_dia(**{"0": 10, "1": 12, "2": 11})
        self.assertEqual(semanas_na_meta(dados, self.hoje, 10), (3, 3))

    def test_a_semana_corrente_ainda_fraca_nao_quebra_a_conta(self):
        # 2h nesta semana nao apagam as tres anteriores: a semana nao acabou.
        dados = self.por_dia(**{"0": 2, "1": 12, "2": 11, "3": 10})
        self.assertEqual(semanas_na_meta(dados, self.hoje, 10)[0], 3)

    def test_uma_semana_fraca_no_meio_quebra(self):
        dados = self.por_dia(**{"0": 10, "1": 3, "2": 11, "3": 12})
        atual, maior = semanas_na_meta(dados, self.hoje, 10)
        self.assertEqual(atual, 1)
        self.assertEqual(maior, 2)

    def test_bater_na_meta_exata_conta(self):
        self.assertEqual(semanas_na_meta(self.por_dia(**{"0": 10}), self.hoje, 10)[0], 1)


class NoHistoricoENoDashboard(CasoBase):
    def test_o_historico_entrega_as_semanas_e_as_folgas(self):
        dados = self.client.get("/api/historico/").json()
        self.assertIn("semanas_na_meta", dados)
        self.assertIn("folgas_restantes", dados)
        self.assertEqual(dados["folgas_por_semana"], self.config.folgas_por_semana)

    def test_o_dashboard_entrega_a_sequencia(self):
        self.criar_sessao(minutos=60)
        sequencia_ = self.client.get("/api/dashboard/").json()["sequencia"]
        self.assertEqual(sequencia_["dias"], 1)
        self.assertTrue(sequencia_["estudou_hoje"])
        self.assertEqual(sequencia_["folgas"], self.config.folgas_por_semana)

    def test_a_folga_e_configuravel_pela_tela(self):
        resposta = self.post("/api/configuracoes/salvar/", {"folgas_por_semana": 3})
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(self.config.folgas_por_semana, 3)

    def test_folga_fora_da_faixa_e_recusada(self):
        resposta = self.post("/api/configuracoes/salvar/", {"folgas_por_semana": 9})
        self.assertEqual(resposta.status_code, 400)
