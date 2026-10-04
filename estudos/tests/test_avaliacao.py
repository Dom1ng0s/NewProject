"""Provas e prazos: cadastro, contagem regressiva e a prioridade que dao a fila."""

from datetime import timedelta


from estudos.models import Avaliacao, Materia, Revisao, Topico
from estudos.services import avaliacoes_proximas, dados_dashboard, dias_ate_a_prova

from .base import CasoBase


class CasoComAvaliacao(CasoBase):
    def criar_avaliacao(self, dias=7, titulo="P1", materia=None, topicos=(), **extra):
        avaliacao = Avaliacao.objects.create(
            materia=materia or self.materia,
            titulo=titulo,
            data=self.hoje + timedelta(days=dias),
            **extra,
        )
        if topicos:
            avaliacao.topicos.set(topicos)
        return avaliacao


class ContagemRegressiva(CasoComAvaliacao):
    def test_dias_restantes_conta_do_hoje(self):
        self.assertEqual(self.criar_avaliacao(dias=3).dias_restantes, 3)
        self.assertEqual(self.criar_avaliacao(dias=0, titulo="P2").dias_restantes, 0)
        self.assertEqual(self.criar_avaliacao(dias=-2, titulo="P3").dias_restantes, -2)

    def test_json_marca_a_que_ja_passou(self):
        passada = self.criar_avaliacao(dias=-1).json()
        futura = self.criar_avaliacao(dias=1, titulo="P2").json()
        self.assertTrue(passada["passou"])
        self.assertFalse(futura["passou"])

    def test_ordem_e_da_mais_proxima_para_a_mais_distante(self):
        self.criar_avaliacao(dias=10, titulo="Longe")
        self.criar_avaliacao(dias=2, titulo="Perto")
        self.assertEqual(
            [a["titulo"] for a in avaliacoes_proximas()], ["Perto", "Longe"]
        )


class ListaDeProximas(CasoComAvaliacao):
    def test_fora_do_horizonte_fica_de_fora(self):
        self.configurar(dias_proximas_avaliacoes=30)
        self.criar_avaliacao(dias=60, titulo="Final")
        self.assertEqual(avaliacoes_proximas(), [])

    def test_data_que_passou_continua_enquanto_nao_for_concluida(self):
        self.configurar(dias_proximas_avaliacoes=30)
        self.criar_avaliacao(dias=-5, titulo="Esquecida")
        self.assertEqual([a["titulo"] for a in avaliacoes_proximas()], ["Esquecida"])

    def test_concluida_sai_da_lista(self):
        self.criar_avaliacao(dias=2, concluida=True)
        self.assertEqual(avaliacoes_proximas(), [])

    def test_horizonte_pode_ser_alargado_na_chamada(self):
        self.criar_avaliacao(dias=60, titulo="Final")
        self.assertEqual(len(avaliacoes_proximas(dias=90)), 1)


class PrioridadeDaFila(CasoComAvaliacao):
    def setUp(self):
        super().setUp()
        self.outro = self.criar_topico("Derivadas")

    def test_mapa_pega_a_prova_mais_proxima_de_cada_topico(self):
        self.criar_avaliacao(dias=9, titulo="P2", topicos=[self.topico])
        self.criar_avaliacao(dias=2, titulo="P1", topicos=[self.topico, self.outro])
        prazos = dias_ate_a_prova(avaliacoes_proximas())
        self.assertEqual(prazos[self.topico.id], 2)
        self.assertEqual(prazos[self.outro.id], 2)

    def test_topico_sem_prova_fica_sem_prazo(self):
        self.criar_avaliacao(dias=2, topicos=[self.topico])
        prazos = dias_ate_a_prova(avaliacoes_proximas())
        self.assertNotIn(self.outro.id, prazos)

    def test_revisao_de_conteudo_de_prova_vem_primeiro(self):
        self.criar_avaliacao(dias=2, topicos=[self.outro])
        Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        Revisao.objects.create(topico=self.outro, data_prevista=self.hoje)

        fila = dados_dashboard()["revisoes_hoje"]
        self.assertEqual([r["topico"] for r in fila], ["Derivadas", "Limites"])
        self.assertEqual(fila[0]["prova_dias"], 2)
        self.assertIsNone(fila[1]["prova_dias"])

    def test_entre_duas_provas_a_mais_proxima_vem_primeiro(self):
        self.criar_avaliacao(dias=1, titulo="Amanhã", topicos=[self.outro])
        self.criar_avaliacao(dias=6, titulo="Semana que vem", topicos=[self.topico])
        Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        Revisao.objects.create(topico=self.outro, data_prevista=self.hoje)
        self.assertEqual(
            [r["topico"] for r in dados_dashboard()["revisoes_hoje"]],
            ["Derivadas", "Limites"],
        )

    def test_sem_prova_a_ordem_continua_pela_data_prevista(self):
        Revisao.objects.create(
            topico=self.topico, data_prevista=self.hoje - timedelta(days=1)
        )
        Revisao.objects.create(
            topico=self.outro, data_prevista=self.hoje - timedelta(days=5)
        )
        atrasadas = dados_dashboard()["revisoes_atrasadas"]
        self.assertEqual([r["topico"] for r in atrasadas], ["Derivadas", "Limites"])

    def test_avaliacao_concluida_nao_prioriza_nada(self):
        self.criar_avaliacao(dias=1, topicos=[self.outro], concluida=True)
        Revisao.objects.create(topico=self.outro, data_prevista=self.hoje)
        self.assertIsNone(dados_dashboard()["revisoes_hoje"][0]["prova_dias"])

    def test_dashboard_entrega_as_avaliacoes(self):
        self.criar_avaliacao(dias=3, titulo="P1")
        self.assertEqual(
            [a["titulo"] for a in dados_dashboard()["avaliacoes"]], ["P1"]
        )


class CriarPelaApi(CasoBase):
    def dados(self, **extra):
        base = {
            "titulo": "P1",
            "materia_id": self.materia.id,
            "data": (self.hoje + timedelta(days=5)).isoformat(),
        }
        base.update(extra)
        return base

    def test_cria_com_o_minimo(self):
        resposta = self.post("/api/avaliacoes/criar/", self.dados())
        self.assertEqual(resposta.status_code, 200)
        avaliacao = Avaliacao.objects.get()
        self.assertEqual(avaliacao.titulo, "P1")
        self.assertEqual(avaliacao.tipo, Avaliacao.PROVA)
        self.assertEqual(resposta.json()["avaliacao"]["dias"], 5)

    def test_cria_com_conteudo_marcado(self):
        outro = self.criar_topico("Derivadas")
        self.post(
            "/api/avaliacoes/criar/",
            self.dados(topico_ids=[self.topico.id, outro.id], tipo="trabalho", peso=2),
        )
        avaliacao = Avaliacao.objects.get()
        self.assertEqual(avaliacao.topicos.count(), 2)
        self.assertEqual(avaliacao.tipo, "trabalho")
        self.assertEqual(avaliacao.peso, 2)

    def test_sem_titulo_e_recusada(self):
        resposta = self.post("/api/avaliacoes/criar/", self.dados(titulo="  "))
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("título", resposta.json()["erro"])
        self.assertEqual(Avaliacao.objects.count(), 0)

    def test_sem_materia_e_recusada(self):
        resposta = self.post("/api/avaliacoes/criar/", self.dados(materia_id=999))
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("matéria", resposta.json()["erro"])

    def test_data_invalida_e_recusada(self):
        resposta = self.post("/api/avaliacoes/criar/", self.dados(data="32/13/2026"))
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("data", resposta.json()["erro"])

    def test_topico_de_outra_materia_e_recusado(self):
        outra = Materia.objects.create(nome="Física")
        alheio = Topico.objects.create(materia=outra, nome="Cinemática")
        resposta = self.post(
            "/api/avaliacoes/criar/", self.dados(topico_ids=[alheio.id])
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("matéria da avaliação", resposta.json()["erro"])

    def test_tipo_invalido_e_recusado(self):
        resposta = self.post("/api/avaliacoes/criar/", self.dados(tipo="inventado"))
        self.assertEqual(resposta.status_code, 400)

    def test_hora_opcional(self):
        self.post("/api/avaliacoes/criar/", self.dados(hora="14:30"))
        self.assertEqual(Avaliacao.objects.get().json()["hora"], "14:30")

    def test_hora_invalida_e_recusada(self):
        resposta = self.post("/api/avaliacoes/criar/", self.dados(hora="25:99"))
        self.assertEqual(resposta.status_code, 400)


class EditarPelaApi(CasoComAvaliacao):
    def test_muda_data_e_titulo(self):
        avaliacao = self.criar_avaliacao(dias=5)
        nova = (self.hoje + timedelta(days=9)).isoformat()
        self.post(
            f"/api/avaliacoes/{avaliacao.id}/editar/", {"titulo": "P1 adiada", "data": nova}
        )
        avaliacao.refresh_from_db()
        self.assertEqual(avaliacao.titulo, "P1 adiada")
        self.assertEqual(avaliacao.data.isoformat(), nova)

    def test_marcar_como_concluida_tira_do_dashboard(self):
        avaliacao = self.criar_avaliacao(dias=2)
        self.post(f"/api/avaliacoes/{avaliacao.id}/editar/", {"concluida": True, "nota": 8.5})
        avaliacao.refresh_from_db()
        self.assertTrue(avaliacao.concluida)
        self.assertEqual(avaliacao.nota, 8.5)
        self.assertEqual(dados_dashboard()["avaliacoes"], [])

    def test_limpar_a_nota(self):
        avaliacao = self.criar_avaliacao(nota=7)
        self.post(f"/api/avaliacoes/{avaliacao.id}/editar/", {"nota": ""})
        avaliacao.refresh_from_db()
        self.assertIsNone(avaliacao.nota)

    def test_limpar_a_hora(self):
        avaliacao = self.criar_avaliacao()
        self.post(f"/api/avaliacoes/{avaliacao.id}/editar/", {"hora": "10:00"})
        self.post(f"/api/avaliacoes/{avaliacao.id}/editar/", {"hora": ""})
        avaliacao.refresh_from_db()
        self.assertIsNone(avaliacao.hora)

    def test_trocar_o_conteudo_que_cai(self):
        outro = self.criar_topico("Derivadas")
        avaliacao = self.criar_avaliacao(topicos=[self.topico])
        self.post(
            f"/api/avaliacoes/{avaliacao.id}/editar/", {"topico_ids": [outro.id]}
        )
        self.assertEqual([t.nome for t in avaliacao.topicos.all()], ["Derivadas"])

    def test_nota_que_nao_e_numero_e_recusada(self):
        avaliacao = self.criar_avaliacao()
        resposta = self.post(f"/api/avaliacoes/{avaliacao.id}/editar/", {"nota": "oito"})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("número", resposta.json()["erro"])

    def test_excluir(self):
        avaliacao = self.criar_avaliacao()
        self.assertEqual(
            self.post(f"/api/avaliacoes/{avaliacao.id}/excluir/").status_code, 200
        )
        self.assertEqual(Avaliacao.objects.count(), 0)

    def test_excluir_a_avaliacao_nao_leva_o_topico(self):
        avaliacao = self.criar_avaliacao(topicos=[self.topico])
        self.post(f"/api/avaliacoes/{avaliacao.id}/excluir/")
        self.assertTrue(Topico.objects.filter(pk=self.topico.pk).exists())

    def test_excluir_a_materia_leva_a_avaliacao(self):
        self.criar_avaliacao()
        self.materia.delete()
        self.assertEqual(Avaliacao.objects.count(), 0)


class ListarPelaApi(CasoComAvaliacao):
    def test_por_padrao_so_as_em_aberto(self):
        self.criar_avaliacao(dias=2, titulo="Aberta")
        self.criar_avaliacao(dias=2, titulo="Fechada", concluida=True)
        dados = self.client.get("/api/avaliacoes/").json()
        self.assertEqual([a["titulo"] for a in dados["avaliacoes"]], ["Aberta"])

    def test_todas_traz_tambem_as_concluidas(self):
        self.criar_avaliacao(dias=2, titulo="Aberta")
        self.criar_avaliacao(dias=2, titulo="Fechada", concluida=True)
        dados = self.client.get("/api/avaliacoes/?todas=1").json()
        self.assertEqual(len(dados["avaliacoes"]), 2)

    def test_a_lista_nao_e_limitada_pelo_horizonte_do_dashboard(self):
        self.criar_avaliacao(dias=120, titulo="Final")
        dados = self.client.get("/api/avaliacoes/").json()
        self.assertEqual([a["titulo"] for a in dados["avaliacoes"]], ["Final"])

    def test_tela_abre(self):
        self.assertEqual(self.client.get("/avaliacoes/").status_code, 200)

    def test_seletor_de_topicos_filtra_por_materia(self):
        outra = Materia.objects.create(nome="Física")
        Topico.objects.create(materia=outra, nome="Cinemática")
        dados = self.client.get(f"/api/topicos/?materia_id={self.materia.id}").json()
        self.assertEqual([t["nome"] for t in dados["topicos"]], ["Limites"])
