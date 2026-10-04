"""Repeticao espacada: quando a revisao nasce, como a nota move a escada e o
que o dashboard ve."""

from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from estudos.models import Cartao, Revisao, Topico
from estudos.services import dados_dashboard

from .base import CasoBase


class PrimeiraRevisao(CasoBase):
    def test_topico_novo_e_agendado_para_o_primeiro_degrau(self):
        self.topico.iniciar_revisoes()
        revisao = Revisao.objects.get()
        self.assertEqual(
            revisao.data_prevista,
            self.hoje + timedelta(days=self.config.primeiro_intervalo_dias),
        )

    def test_nao_agenda_duas_vezes_enquanto_houver_pendente(self):
        self.topico.iniciar_revisoes()
        self.assertIsNone(self.topico.iniciar_revisoes())
        self.assertEqual(Revisao.objects.count(), 1)

    def test_estudar_de_novo_nao_derruba_a_escada(self):
        # Topico ja com intervalo longo: estudar outra vez nao pode traze-lo de
        # volta para o primeiro degrau.
        self.topico.responder(5)
        self.topico.responder(5)
        self.topico.responder(5)
        intervalo = self.topico.intervalo_dias
        Revisao.objects.filter(feita=False).delete()

        self.topico.iniciar_revisoes()
        self.assertEqual(
            Revisao.objects.get(feita=False).data_prevista,
            self.hoje + timedelta(days=intervalo),
        )

    def test_respeita_a_configuracao(self):
        self.configurar(primeiro_intervalo_dias=2)
        self.topico.iniciar_revisoes()
        self.assertEqual(
            Revisao.objects.get().data_prevista, self.hoje + timedelta(days=2)
        )


class EscadaDoSM2(CasoBase):
    def test_acertos_seguidos_sobem_os_degraus(self):
        self.topico.responder(4)
        self.assertEqual(self.topico.intervalo_dias, self.config.primeiro_intervalo_dias)
        self.topico.responder(4)
        self.assertEqual(self.topico.intervalo_dias, self.config.segundo_intervalo_dias)

        anterior = self.topico.intervalo_dias
        self.topico.responder(4)
        # Do terceiro acerto em diante o intervalo e multiplicado pela facilidade.
        self.assertEqual(self.topico.intervalo_dias, round(anterior * self.topico.facilidade))

    def test_errar_volta_ao_primeiro_degrau(self):
        for _ in range(3):
            self.topico.responder(5)
        self.assertGreater(self.topico.intervalo_dias, self.config.segundo_intervalo_dias)

        self.topico.responder(0)
        self.assertEqual(self.topico.intervalo_dias, self.config.primeiro_intervalo_dias)
        self.assertEqual(self.topico.acertos_seguidos, 0)

    def test_depois_de_errar_a_escada_recomeca_do_inicio(self):
        for _ in range(3):
            self.topico.responder(5)
        self.topico.responder(0)
        self.topico.responder(4)
        self.assertEqual(self.topico.intervalo_dias, self.config.primeiro_intervalo_dias)
        self.topico.responder(4)
        self.assertEqual(self.topico.intervalo_dias, self.config.segundo_intervalo_dias)

    def test_facil_aumenta_a_facilidade_e_dificil_derruba(self):
        inicial = self.topico.facilidade
        self.topico.responder(5)
        self.assertGreater(self.topico.facilidade, inicial)

        depois = self.topico.facilidade
        self.topico.responder(3)
        self.assertLess(self.topico.facilidade, depois)

    def test_bom_quase_nao_mexe_na_facilidade(self):
        inicial = self.topico.facilidade
        self.topico.responder(4)
        self.assertAlmostEqual(self.topico.facilidade, inicial, places=2)

    def test_facilidade_tem_piso(self):
        for _ in range(30):
            self.topico.responder(0)
        self.assertEqual(self.topico.facilidade, self.config.facilidade_minima)

    def test_intervalo_tem_teto(self):
        self.configurar(intervalo_maximo_dias=30)
        for _ in range(20):
            self.topico.responder(5)
        self.assertEqual(self.topico.intervalo_dias, 30)

    def test_o_intervalo_sempre_cresce_depois_de_um_acerto(self):
        # Com a facilidade no piso (1.3) o arredondamento poderia travar o
        # intervalo; ele tem de andar pelo menos um dia.
        self.topico.facilidade = self.config.facilidade_minima
        self.topico.save()
        for _ in range(4):
            anterior = self.topico.intervalo_dias
            self.topico.responder(3)
            self.assertGreaterEqual(self.topico.intervalo_dias, anterior)

    def test_responder_agenda_a_proxima(self):
        self.topico.responder(4)
        revisao = Revisao.objects.get(feita=False)
        self.assertEqual(
            revisao.data_prevista, self.hoje + timedelta(days=self.topico.intervalo_dias)
        )
        self.assertEqual(revisao.qualidade, 4)

    def test_nota_fora_da_faixa_e_aparada(self):
        self.topico.responder(99)
        self.assertEqual(self.topico.acertos_seguidos, 1)
        self.topico.responder(-5)
        self.assertEqual(self.topico.acertos_seguidos, 0)


class ResponderPelaApi(CasoBase):
    def abrir(self):
        return Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)

    def test_bom_fecha_a_revisao_e_agenda_a_proxima(self):
        revisao = self.abrir()
        resposta = self.post(f"/api/revisoes/{revisao.id}/responder/", {"resposta": "bom"})
        self.assertEqual(resposta.status_code, 200)

        revisao.refresh_from_db()
        self.topico.refresh_from_db()
        self.assertTrue(revisao.feita)
        self.assertEqual(revisao.qualidade, 4)
        self.assertIsNotNone(revisao.feita_em)
        self.assertEqual(self.topico.status, Topico.REVISADO)
        self.assertEqual(resposta.json()["intervalo_dias"], self.topico.intervalo_dias)
        self.assertEqual(Revisao.objects.filter(feita=False).count(), 1)

    def test_errei_devolve_o_topico_para_estudando(self):
        self.topico.status = Topico.DOMINADO
        self.topico.save()
        revisao = self.abrir()
        self.post(f"/api/revisoes/{revisao.id}/responder/", {"resposta": "errei"})
        self.topico.refresh_from_db()
        self.assertEqual(self.topico.status, Topico.ESTUDANDO)
        self.assertEqual(self.topico.intervalo_dias, self.config.primeiro_intervalo_dias)

    def test_acertar_nao_rebaixa_um_topico_dominado(self):
        self.topico.status = Topico.DOMINADO
        self.topico.save()
        self.post(f"/api/revisoes/{self.abrir().id}/responder/", {"resposta": "facil"})
        self.topico.refresh_from_db()
        self.assertEqual(self.topico.status, Topico.DOMINADO)

    def test_dificil_marca_a_revisao_como_dificil(self):
        revisao = self.abrir()
        self.post(f"/api/revisoes/{revisao.id}/responder/", {"resposta": "dificil"})
        revisao.refresh_from_db()
        self.assertTrue(revisao.dificil)

    def test_bom_nao_e_dificil(self):
        revisao = self.abrir()
        self.post(f"/api/revisoes/{revisao.id}/responder/", {"resposta": "bom"})
        revisao.refresh_from_db()
        self.assertFalse(revisao.dificil)

    def test_resposta_desconhecida_e_recusada(self):
        revisao = self.abrir()
        resposta = self.post(f"/api/revisoes/{revisao.id}/responder/", {"resposta": "talvez"})
        self.assertEqual(resposta.status_code, 400)
        revisao.refresh_from_db()
        self.assertFalse(revisao.feita)

    def test_a_revisao_nunca_acaba(self):
        """Fechar uma revisao sempre deixa a proxima marcada."""
        for _ in range(6):
            pendente = Revisao.objects.filter(feita=False).first() or self.abrir()
            self.post(f"/api/revisoes/{pendente.id}/responder/", {"resposta": "bom"})
            self.assertTrue(Revisao.objects.filter(feita=False).exists())

    def test_duas_revisoes_fechadas_no_mesmo_dia_nao_duplicam_a_proxima(self):
        primeira = self.abrir()
        segunda = Revisao.objects.create(
            topico=self.topico, data_prevista=self.hoje - timedelta(days=3)
        )
        self.post(f"/api/revisoes/{primeira.id}/responder/", {"resposta": "errei"})
        self.post(f"/api/revisoes/{segunda.id}/responder/", {"resposta": "errei"})
        self.assertEqual(Revisao.objects.filter(feita=False).count(), 1)

    def test_registrar_sessao_agenda_a_primeira_revisao(self):
        resposta = self.post(
            "/api/sessoes/criar/", {"topico_id": self.topico.id, "duracao_min": 50}
        )
        self.assertTrue(resposta.json()["revisao_agendada"])
        self.topico.refresh_from_db()
        self.assertEqual(self.topico.status, Topico.ESTUDANDO)
        self.assertEqual(Revisao.objects.count(), 1)

    def test_sessao_sem_duracao_nao_agenda_nada(self):
        resposta = self.post(
            "/api/sessoes/criar/", {"topico_id": self.topico.id, "duracao_min": 0}
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(Revisao.objects.count(), 0)

    def test_status_revisado_agenda_sem_precisar_de_sessao(self):
        resposta = self.post(
            f"/api/topicos/{self.topico.id}/status/", {"status": Topico.DOMINADO}
        )
        self.assertTrue(resposta.json()["revisao_agendada"])

    def test_status_estudando_nao_agenda(self):
        self.post(f"/api/topicos/{self.topico.id}/status/", {"status": Topico.ESTUDANDO})
        self.assertEqual(Revisao.objects.count(), 0)


class CartoesDaRevisao(CasoBase):
    def test_a_revisao_entrega_os_cartoes_na_ordem(self):
        Cartao.objects.create(topico=self.topico, frente="B", verso="2", ordem=2)
        Cartao.objects.create(topico=self.topico, frente="A", verso="1", ordem=1)
        revisao = Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)

        dados = self.client.get(f"/api/revisoes/{revisao.id}/cartoes/").json()
        self.assertEqual([c["frente"] for c in dados["cartoes"]], ["A", "B"])
        self.assertEqual(dados["revisao"]["cartoes"], 2)

    def test_topico_sem_cartao_ainda_pode_ser_revisado(self):
        revisao = Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        dados = self.client.get(f"/api/revisoes/{revisao.id}/cartoes/").json()
        self.assertEqual(dados["cartoes"], [])
        self.assertEqual(
            self.post(f"/api/revisoes/{revisao.id}/responder/", {"resposta": "bom"}).status_code,
            200,
        )

    def test_cartao_de_outro_topico_nao_entra(self):
        outro = self.criar_topico("Derivadas")
        Cartao.objects.create(topico=outro, frente="X", verso="Y")
        revisao = Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        dados = self.client.get(f"/api/revisoes/{revisao.id}/cartoes/").json()
        self.assertEqual(dados["cartoes"], [])


class CrudDeCartoes(CasoBase):
    def test_criar(self):
        resposta = self.post(
            "/api/cartoes/criar/",
            {"topico_id": self.topico.id, "frente": "O que é limite?", "verso": "Tendência"},
        )
        self.assertEqual(resposta.status_code, 200)
        cartao = Cartao.objects.get()
        self.assertEqual(cartao.frente, "O que é limite?")
        self.assertEqual(cartao.topico, self.topico)

    def test_a_ordem_segue_a_de_cadastro(self):
        for i in range(3):
            self.post(
                "/api/cartoes/criar/",
                {"topico_id": self.topico.id, "frente": f"P{i}", "verso": "R"},
            )
        self.assertEqual([c.ordem for c in Cartao.objects.all()], [0, 1, 2])

    def test_sem_pergunta_e_recusado(self):
        resposta = self.post(
            "/api/cartoes/criar/", {"topico_id": self.topico.id, "frente": " ", "verso": "R"}
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("pergunta", resposta.json()["erro"])
        self.assertEqual(Cartao.objects.count(), 0)

    def test_sem_resposta_e_recusado(self):
        resposta = self.post(
            "/api/cartoes/criar/", {"topico_id": self.topico.id, "frente": "P", "verso": ""}
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("resposta", resposta.json()["erro"])

    def test_topico_inexistente_da_404(self):
        resposta = self.post(
            "/api/cartoes/criar/", {"topico_id": 999, "frente": "P", "verso": "R"}
        )
        self.assertEqual(resposta.status_code, 404)

    def test_editar(self):
        cartao = Cartao.objects.create(topico=self.topico, frente="P", verso="R")
        self.post(f"/api/cartoes/{cartao.id}/editar/", {"frente": "P2", "verso": "R2"})
        cartao.refresh_from_db()
        self.assertEqual((cartao.frente, cartao.verso), ("P2", "R2"))

    def test_excluir(self):
        cartao = Cartao.objects.create(topico=self.topico, frente="P", verso="R")
        self.post(f"/api/cartoes/{cartao.id}/excluir/")
        self.assertEqual(Cartao.objects.count(), 0)

    def test_excluir_o_topico_leva_os_cartoes(self):
        Cartao.objects.create(topico=self.topico, frente="P", verso="R")
        self.topico.delete()
        self.assertEqual(Cartao.objects.count(), 0)

    def test_listar_filtra_por_topico(self):
        outro = self.criar_topico("Derivadas")
        Cartao.objects.create(topico=self.topico, frente="A", verso="1")
        Cartao.objects.create(topico=outro, frente="B", verso="2")
        dados = self.client.get(f"/api/cartoes/?topico_id={self.topico.id}").json()
        self.assertEqual([c["frente"] for c in dados["cartoes"]], ["A"])


class FilaDoDashboard(CasoBase):
    def test_separa_hoje_de_atrasada_e_ignora_futuro(self):
        Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        Revisao.objects.create(
            topico=self.topico, data_prevista=self.hoje - timedelta(days=2)
        )
        Revisao.objects.create(
            topico=self.topico, data_prevista=self.hoje + timedelta(days=5)
        )
        dados = dados_dashboard()
        self.assertEqual(len(dados["revisoes_hoje"]), 1)
        self.assertEqual(len(dados["revisoes_atrasadas"]), 1)
        self.assertTrue(dados["revisoes_atrasadas"][0]["atrasada"])

    def test_revisao_feita_sai_da_fila(self):
        Revisao.objects.create(topico=self.topico, data_prevista=self.hoje, feita=True)
        self.assertEqual(dados_dashboard()["revisoes_hoje"], [])

    def test_a_fila_diz_quantos_cartoes_cada_topico_tem(self):
        Cartao.objects.create(topico=self.topico, frente="P", verso="R")
        Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        self.assertEqual(dados_dashboard()["revisoes_hoje"][0]["cartoes"], 1)

    def test_materia_sem_sessao_recente_entra_em_parada(self):
        self.configurar(dias_materia_parada=7, meta_horas_semanais=10)
        self.criar_sessao(dias_atras=20, minutos=60)
        paradas = dados_dashboard()["materias_paradas"]
        self.assertEqual([p["nome"] for p in paradas], ["Cálculo"])

    def test_materia_estudada_hoje_nao_esta_parada(self):
        self.configurar(dias_materia_parada=7)
        self.criar_sessao(dias_atras=0, minutos=30)
        self.assertEqual(dados_dashboard()["materias_paradas"], [])

    def test_horas_da_semana_contam_so_a_semana_corrente(self):
        self.configurar(meta_horas_semanais=10)
        self.criar_sessao(dias_atras=0, minutos=120)
        self.criar_sessao(dias_atras=40, minutos=300)
        dados = dados_dashboard()
        self.assertEqual(dados["horas_semana"], 2.0)
        self.assertEqual(dados["percentual_meta"], 20)

    def test_percentual_da_meta_nao_passa_de_cem(self):
        self.configurar(meta_horas_semanais=1)
        self.criar_sessao(minutos=600)
        self.assertEqual(dados_dashboard()["percentual_meta"], 100)

    def test_percentual_dominado_por_materia(self):
        self.criar_topico("Derivadas", status=Topico.DOMINADO)
        materia = next(m for m in dados_dashboard()["materias"] if m["nome"] == "Cálculo")
        self.assertEqual((materia["total"], materia["dominados"]), (2, 1))
        self.assertEqual(materia["percentual"], 50)

    def test_materia_sem_topico_nao_divide_por_zero(self):
        self.topico.delete()
        materia = next(m for m in dados_dashboard()["materias"] if m["nome"] == "Cálculo")
        self.assertEqual(materia["percentual"], 0)


class ArvoreDeTopicos(CasoBase):
    def test_nivel_vai_de_um_a_tres(self):
        assunto = self.criar_topico("Continuidade", pai=self.topico)
        sub = self.criar_topico("Teorema do confronto", pai=assunto)
        self.assertEqual((self.topico.nivel, assunto.nivel, sub.nivel), (1, 2, 3))

    def test_excluir_a_materia_leva_topicos_sessoes_e_revisoes(self):
        self.criar_sessao()
        self.topico.iniciar_revisoes()
        self.materia.delete()
        self.assertEqual(Topico.objects.count(), 0)
        self.assertEqual(Revisao.objects.count(), 0)


class TelasRespondem(CasoBase):
    def test_todas_as_paginas_abrem(self):
        for url in (
            "/",
            "/materias/",
            "/sessao/",
            "/planner/",
            "/quadro/",
            "/revisar/",
            "/avaliacoes/",
            "/dados/",
        ):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_dashboard_responde_json(self):
        resposta = self.client.get("/api/dashboard/")
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["hoje"], timezone.localdate().isoformat())


class LimpezaDoAgendamentoAntigo(CasoBase):
    """A migração 0006 deixa uma revisão pendente por tópico."""

    def test_mantem_a_mais_proxima_e_apaga_as_outras(self):
        from estudos.migrations import (
            __name__ as _,  # noqa: F401  (garante o pacote carregado)
        )
        from importlib import import_module

        modulo = import_module("estudos.migrations.0006_uma_revisao_pendente_por_topico")

        outro = self.criar_topico("Derivadas")
        for dias in (30, 1, 15):
            Revisao.objects.create(
                topico=self.topico, data_prevista=self.hoje + timedelta(days=dias)
            )
        feita = Revisao.objects.create(
            topico=self.topico, data_prevista=self.hoje - timedelta(days=3), feita=True
        )
        Revisao.objects.create(topico=outro, data_prevista=self.hoje + timedelta(days=7))

        class Apps:
            def get_model(self, app, modelo):
                return Revisao

        modulo.manter_a_mais_proxima(Apps(), None)

        pendentes = Revisao.objects.filter(feita=False)
        self.assertEqual(pendentes.filter(topico=self.topico).count(), 1)
        self.assertEqual(
            pendentes.get(topico=self.topico).data_prevista,
            self.hoje + timedelta(days=1),
        )
        # A de outro tópico fica, e a já feita é histórico: não se mexe.
        self.assertEqual(pendentes.filter(topico=outro).count(), 1)
        self.assertTrue(Revisao.objects.filter(pk=feita.pk).exists())


class ContratoDoAvisoDeAgendamento(CasoBase):
    """A tela lia uma chave que a API nunca mandou, e o aviso sumia calado.

    Erro de digitação em JavaScript não quebra nada: `r.revisoes_criadas` era
    `undefined`, o `if` dava falso e o aviso simplesmente não aparecia. Estes
    testes prendem os dois lados do combinado.
    """

    ARQUIVOS = ["materias.js", "quadro.js"]

    def fonte(self, nome):
        caminho = Path(settings.BASE_DIR) / "static" / "js" / nome
        return caminho.read_text(encoding="utf-8")

    def test_a_api_responde_com_revisao_agendada(self):
        resposta = self.post(
            f"/api/topicos/{self.topico.id}/status/", {"status": Topico.REVISADO}
        )
        self.assertEqual(
            set(resposta.json()), {"ok", "topico", "revisao_agendada"}
        )

    def test_e_um_booleano_e_nao_uma_contagem(self):
        dados = self.post(
            f"/api/topicos/{self.topico.id}/status/", {"status": Topico.REVISADO}
        ).json()
        self.assertIsInstance(dados["revisao_agendada"], bool)

    def test_as_telas_leem_a_chave_que_existe(self):
        for nome in self.ARQUIVOS:
            with self.subTest(arquivo=nome):
                self.assertIn("revisao_agendada", self.fonte(nome))

    def test_nenhuma_tela_le_a_chave_que_nunca_existiu(self):
        for nome in self.ARQUIVOS:
            with self.subTest(arquivo=nome):
                self.assertNotIn("revisoes_criadas", self.fonte(nome))
