"""A carta da manga: um cartão ao acaso, sem nota e sem SM-2.

A porta de entrada mais barata que o app tem. O que importa testar é o que ela
NÃO faz: não fecha fila, não dá nota e não move intervalo nenhum. Um sorteio
que mexesse na escada seria outra coisa, e pior.
"""

from estudos.models import Cartao, Revisao, Topico

from .base import CasoBase


class CartaoSurpresa(CasoBase):
    def cartao(self, topico, frente="O que é um limite?"):
        return Cartao.objects.create(topico=topico, frente=frente, verso="É isto.")

    def dominar(self, topico):
        topico.status = Topico.DOMINADO
        topico.save(update_fields=["status"])
        return topico

    def test_sem_cartao_nenhum_a_api_diz_que_nao_ha(self):
        resposta = self.client.get("/api/cartoes/surpresa/")
        self.assertEqual(resposta.status_code, 404)

    def test_cartao_de_topico_nao_iniciado_nao_vale(self):
        """Tem de ser um acerto fácil: isto é curiosidade, não revisão."""
        self.cartao(self.topico)
        self.assertEqual(self.client.get("/api/cartoes/surpresa/").status_code, 404)

    def test_pesca_num_topico_dominado(self):
        self.cartao(self.dominar(self.topico))
        dados = self.client.get("/api/cartoes/surpresa/").json()
        self.assertEqual(dados["topico_id"], self.topico.id)
        self.assertEqual(dados["materia"], self.materia.nome)
        self.assertEqual(dados["cartao"]["verso"], "É isto.")

    def test_sem_dominado_aceita_um_revisado(self):
        self.topico.status = Topico.REVISADO
        self.topico.save(update_fields=["status"])
        self.cartao(self.topico)
        self.assertEqual(
            self.client.get("/api/cartoes/surpresa/").json()["topico_id"], self.topico.id
        )

    def test_o_dominado_vem_antes_do_revisado(self):
        self.topico.status = Topico.REVISADO
        self.topico.save(update_fields=["status"])
        self.cartao(self.topico)

        dominado = self.dominar(self.criar_topico("Derivadas"))
        self.cartao(dominado, frente="E a derivada?")

        for _ in range(5):  # o sorteio nao pode cair no revisado nenhuma vez
            dados = self.client.get("/api/cartoes/surpresa/").json()
            self.assertEqual(dados["topico_id"], dominado.id)

    def test_nao_fecha_revisao_nem_move_a_escada(self):
        topico = self.dominar(self.topico)
        self.cartao(topico)
        revisao = Revisao.objects.create(topico=topico, data_prevista=self.hoje)
        antes = (topico.facilidade, topico.intervalo_dias, topico.acertos_seguidos)

        self.client.get("/api/cartoes/surpresa/")

        topico.refresh_from_db()
        revisao.refresh_from_db()
        self.assertEqual(
            (topico.facilidade, topico.intervalo_dias, topico.acertos_seguidos), antes
        )
        self.assertFalse(revisao.feita)
        self.assertEqual(topico.respostas.count(), 0)

    def test_leva_o_foco_sugerido_para_virar_sessao(self):
        # O botao do dialogo e o ponto: quem abriu por curiosidade sai estudando.
        self.cartao(self.dominar(self.topico))
        dados = self.client.get("/api/cartoes/surpresa/").json()
        self.assertEqual(dados["minutos"], self.config.pomodoro_foco_min)

    def test_a_api_nao_aceita_post(self):
        self.assertEqual(self.client.post("/api/cartoes/surpresa/").status_code, 405)
