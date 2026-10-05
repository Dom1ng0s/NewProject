"""A escada do SM-2 dita em voz alta: o intervalo que a nota acabou de mover.

Ver "1 → 6 dias" é a única recompensa honesta que a revisão tem para dar, e
ela só existe se a resposta da API souber de onde o tópico veio.
"""

from estudos.models import Revisao
from estudos.services import escada_dos_topicos

from .base import CasoBase


class EscadaDosTopicos(CasoBase):
    def responder(self, resposta, topico=None):
        revisao = Revisao.objects.create(
            topico=topico or self.topico, data_prevista=self.hoje
        )
        return self.post(f"/api/revisoes/{revisao.id}/responder/", {"resposta": resposta})

    def test_topico_sem_resposta_nao_tem_escada(self):
        self.assertEqual(escada_dos_topicos(), {})

    def test_os_passos_vem_do_antigo_para_o_novo(self):
        self.responder("bom")
        self.responder("bom")
        self.responder("bom")
        passos = escada_dos_topicos()[self.topico.id]
        self.assertEqual(len(passos), 3)
        self.assertEqual(passos, sorted(passos))
        self.assertEqual(passos[0], self.config.primeiro_intervalo_dias)
        self.assertEqual(passos[1], self.config.segundo_intervalo_dias)

    def test_errar_derruba_o_degrau(self):
        self.responder("bom")
        self.responder("bom")
        self.responder("errei")
        passos = escada_dos_topicos()[self.topico.id]
        self.assertEqual(passos[-1], self.config.primeiro_intervalo_dias)
        self.assertLess(passos[-1], passos[-2])

    def test_guarda_so_os_ultimos_passos(self):
        for _ in range(5):
            self.responder("bom")
        self.assertEqual(len(escada_dos_topicos(quantos=3)[self.topico.id]), 3)

    def test_cada_topico_tem_a_sua(self):
        outro = self.criar_topico("Derivadas")
        self.responder("bom")
        self.responder("bom", topico=outro)
        escada = escada_dos_topicos()
        self.assertEqual(len(escada), 2)
        self.assertIn(outro.id, escada)


class NaRespostaDaRevisao(CasoBase):
    def test_a_resposta_diz_o_degrau_de_antes_e_o_de_depois(self):
        revisao = Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        saida = self.post(
            f"/api/revisoes/{revisao.id}/responder/", {"resposta": "bom"}
        ).json()
        self.assertEqual(saida["intervalo_antes"], 0)
        self.assertEqual(saida["intervalo_depois"], self.config.primeiro_intervalo_dias)
        self.assertEqual(saida["topico"], self.topico.nome)

    def test_o_segundo_acerto_sobe_de_degrau(self):
        for _ in range(2):
            revisao = Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
            saida = self.post(
                f"/api/revisoes/{revisao.id}/responder/", {"resposta": "bom"}
            ).json()
        self.assertEqual(saida["intervalo_antes"], self.config.primeiro_intervalo_dias)
        self.assertEqual(saida["intervalo_depois"], self.config.segundo_intervalo_dias)


class NaArvore(CasoBase):
    def test_o_topico_leva_a_escada_para_a_tela(self):
        revisao = Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        self.post(f"/api/revisoes/{revisao.id}/responder/", {"resposta": "bom"})

        arvore = self.client.get("/api/arvore/").json()
        topico = arvore["materias"][0]["topicos"][0]
        self.assertEqual(topico["escada"], [self.config.primeiro_intervalo_dias])

    def test_topico_sem_historico_leva_uma_lista_vazia(self):
        arvore = self.client.get("/api/arvore/").json()
        self.assertEqual(arvore["materias"][0]["topicos"][0]["escada"], [])
