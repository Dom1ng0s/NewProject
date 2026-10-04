"""Tópicos frágeis: o que o log sabe e o estado do tópico não conta."""

from datetime import timedelta

from django.utils import timezone

from estudos.models import RespostaRevisao, SessaoEstudo
from estudos.services import (
    DIAS_DA_FRAGILIDADE,
    interrupcoes_e_erro,
    pontos_de_fragilidade,
    topicos_frageis,
)

from .base import CasoBase


class CasoComLog(CasoBase):
    def responder(self, topico, qualidade, dias_atras=0):
        """Uma linha de log direta: o caminho pelo SM-2 já tem testes próprios."""
        return RespostaRevisao.objects.create(
            topico=topico,
            qualidade=qualidade,
            respondida_em=timezone.now() - timedelta(days=dias_atras),
            data_prevista=self.hoje - timedelta(days=dias_atras),
            status_antes=topico.status,
            facilidade_antes=topico.facilidade,
            intervalo_antes=topico.intervalo_dias,
            acertos_antes=topico.acertos_seguidos,
            facilidade_depois=topico.facilidade,
            intervalo_depois=topico.intervalo_dias,
        )


class ListaDeFrageis(CasoComLog):
    def test_sem_respostas_a_lista_e_vazia(self):
        self.assertEqual(topicos_frageis(), [])

    def test_topico_que_so_acerta_fica_fora(self):
        for dias in (1, 2, 3):
            self.responder(self.topico, 5, dias)
        self.assertEqual(topicos_frageis(), [])

    def test_uma_resposta_so_nao_e_padrao(self):
        self.responder(self.topico, 0)
        self.assertEqual(topicos_frageis(), [])

    def test_errar_em_duas_de_tres_entra_na_lista(self):
        self.responder(self.topico, 0, 3)
        self.responder(self.topico, 0, 2)
        self.responder(self.topico, 4, 1)

        (frageil,) = topicos_frageis()
        self.assertEqual(frageil["topico"], self.topico.nome)
        self.assertEqual(frageil["erros"], 2)
        self.assertEqual(frageil["respostas"], 3)
        self.assertEqual(frageil["taxa_erro"], 67)

    def test_fora_do_periodo_nao_conta(self):
        for dias in (DIAS_DA_FRAGILIDADE + 10, DIAS_DA_FRAGILIDADE + 20):
            self.responder(self.topico, 0, dias)
        self.assertEqual(topicos_frageis(), [])

    def test_a_facilidade_derrubada_pesa_na_ordem(self):
        frageil = self.criar_topico("Integrais")
        frageil.facilidade = 1.5
        frageil.save()
        teimoso = self.criar_topico("Séries")

        for topico in (frageil, teimoso):
            self.responder(topico, 0, 2)
            self.responder(topico, 4, 1)

        nomes = [t["topico"] for t in topicos_frageis()]
        self.assertEqual(nomes, ["Integrais", "Séries"])

    def test_a_conta_dos_pontos_e_explicavel(self):
        self.assertEqual(pontos_de_fragilidade(2, 1.9), 3.2)
        self.assertEqual(pontos_de_fragilidade(2, 2.5), 2)
        # Facilidade acima do início não vira crédito negativo.
        self.assertEqual(pontos_de_fragilidade(1, 2.9), 1)

    def test_a_lista_tem_teto(self):
        for i in range(12):
            topico = self.criar_topico(f"Tópico {i}")
            self.responder(topico, 0, 2)
            self.responder(topico, 0, 1)
        self.assertEqual(len(topicos_frageis(quantos=8)), 8)

    def test_leva_a_media_de_interrupcoes_do_topico(self):
        self.responder(self.topico, 0, 2)
        self.responder(self.topico, 0, 1)
        for interrupcoes in (2, 4):
            SessaoEstudo.objects.create(
                topico=self.topico, duracao_min=50, interrupcoes=interrupcoes
            )
        self.assertEqual(topicos_frageis()[0]["interrupcoes_media"], 3.0)

    def test_a_api_do_historico_entrega_a_lista(self):
        self.responder(self.topico, 0, 2)
        self.responder(self.topico, 0, 1)
        dados = self.client.get("/api/historico/").json()
        self.assertEqual(len(dados["frageis"]), 1)
        self.assertIn("interrupcoes_e_erro", dados)


class InterrupcoesEErro(CasoComLog):
    def test_sem_sessao_nao_ha_comparacao(self):
        self.responder(self.topico, 0)
        d = interrupcoes_e_erro()
        self.assertIsNone(d["com_erro"])

    def test_compara_quem_errou_com_quem_nao_errou(self):
        certo = self.criar_topico("Fácil")
        self.responder(self.topico, 0)
        self.responder(certo, 5)
        SessaoEstudo.objects.create(topico=self.topico, duracao_min=50, interrupcoes=6)
        SessaoEstudo.objects.create(topico=certo, duracao_min=50, interrupcoes=1)

        d = interrupcoes_e_erro()
        self.assertEqual(d["com_erro"], 6.0)
        self.assertEqual(d["sem_erro"], 1.0)
        self.assertEqual((d["topicos_com_erro"], d["topicos_sem_erro"]), (1, 1))

    def test_a_media_e_por_sessao_e_nao_por_topico(self):
        self.responder(self.topico, 0)
        SessaoEstudo.objects.create(topico=self.topico, duracao_min=50, interrupcoes=0)
        SessaoEstudo.objects.create(topico=self.topico, duracao_min=50, interrupcoes=0)
        SessaoEstudo.objects.create(topico=self.topico, duracao_min=50, interrupcoes=9)
        self.assertEqual(interrupcoes_e_erro()["com_erro"], 3.0)

    def test_topico_sem_resposta_nenhuma_fica_de_fora_dos_dois_lados(self):
        nunca = self.criar_topico("Nunca revisado")
        SessaoEstudo.objects.create(topico=nunca, duracao_min=50, interrupcoes=9)
        self.responder(self.topico, 5)
        SessaoEstudo.objects.create(topico=self.topico, duracao_min=50, interrupcoes=1)
        self.assertEqual(interrupcoes_e_erro()["sem_erro"], 1.0)
