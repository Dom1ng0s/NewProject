"""O laço do hábito: o fecho do dia, o investimento, os marcos e o lembrete.

Tudo aqui existe para o app ser aberto amanhã, e nenhuma destas contas inventa
número: o investimento é a soma do que aconteceu, o marco é um fato que já
estava no banco, e o lembrete só fala quando há o que fazer. Os testes guardam
justamente isso -- que nada daqui pode ser farmado sem estudar, e que nada daqui
cobra um dia perdido.
"""

from datetime import timedelta

from django.utils import timezone

from estudos.models import Marco, Revisao, SessaoEstudo, Topico
from estudos.services import (
    dados_lembrete,
    horario_de_estudo,
    investimento,
    marcos_de_agora,
    marcos_novos,
    media_de_interrupcoes,
    resumo_da_sequencia,
    resumo_da_sessao,
)

from .base import CasoBase


class Investimento(CasoBase):
    """O total de sempre, que é o que fica caro de abandonar."""

    def test_sem_nada_e_tudo_zero(self):
        d = investimento()
        self.assertEqual(d["horas"], 0)
        self.assertEqual(d["dias"], 0)
        self.assertEqual(d["desde"], "")

    def test_soma_horas_dias_e_revisoes(self):
        self.criar_sessao(dias_atras=0, minutos=90)
        self.criar_sessao(dias_atras=1, minutos=30)
        Revisao.objects.create(
            topico=self.topico,
            data_prevista=self.hoje,
            feita=True,
            feita_em=timezone.now(),
        )
        d = investimento()
        self.assertEqual(d["horas"], 2.0)
        self.assertEqual(d["dias"], 2)
        self.assertEqual(d["sessoes"], 2)
        self.assertEqual(d["revisoes"], 1)

    def test_duas_sessoes_no_mesmo_dia_contam_um_dia(self):
        self.criar_sessao(dias_atras=0, minutos=30)
        self.criar_sessao(dias_atras=0, minutos=30)
        self.assertEqual(investimento()["dias"], 1)

    def test_nao_ve_o_que_e_de_outro_perfil(self):
        self.criar_sessao(minutos=60)
        outro = self.criar_perfil("Outra")
        self.entrar(outro)
        self.assertEqual(investimento()["horas"], 0)


class ResumoDaSessao(CasoBase):
    """O fim da sessão com número: o esforço visto no instante em que mexeu."""

    def test_devolve_o_que_mudou(self):
        self.configurar(meta_horas_semanais=10)
        sessao = self.criar_sessao(minutos=60)
        r = resumo_da_sessao(sessao)
        self.assertEqual(r["minutos"], 60)
        self.assertEqual(r["horas_semana"], 1.0)
        self.assertEqual(r["percentual_meta"], 10)
        self.assertEqual(r["faltam_min"], 540)
        self.assertFalse(r["bateu_meta"])

    def test_meta_batida_nao_pede_mais(self):
        self.configurar(meta_horas_semanais=1)
        sessao = self.criar_sessao(minutos=90)
        r = resumo_da_sessao(sessao)
        self.assertTrue(r["bateu_meta"])
        self.assertEqual(r["faltam_min"], 0)
        self.assertEqual(r["percentual_meta"], 100)

    def test_a_propria_sessao_fica_fora_da_media_dela(self):
        """Comparar a sessão com uma média que já a inclui não compara nada."""
        SessaoEstudo.objects.create(
            topico=self.topico, inicio=timezone.now(), duracao_min=30, interrupcoes=4
        )
        nova = SessaoEstudo.objects.create(
            topico=self.topico, inicio=timezone.now(), duracao_min=30, interrupcoes=0
        )
        self.assertEqual(resumo_da_sessao(nova)["media_interrupcoes"], 4.0)

    def test_primeira_sessao_nao_tem_media(self):
        """Sem histórico, "0,0 de média" seria um recorde inventado."""
        sessao = self.criar_sessao(minutos=25)
        self.assertIsNone(resumo_da_sessao(sessao)["media_interrupcoes"])

    def test_media_so_olha_a_janela_recente(self):
        SessaoEstudo.objects.create(
            topico=self.topico,
            inicio=timezone.now() - timedelta(days=200),
            duracao_min=30,
            interrupcoes=9,
        )
        nova = self.criar_sessao(minutos=30)
        self.assertIsNone(media_de_interrupcoes(fora=nova.pk))

    def test_conta_o_dia_inteiro_nao_so_esta_sessao(self):
        self.criar_sessao(minutos=25)
        sessao = self.criar_sessao(minutos=35)
        r = resumo_da_sessao(sessao)
        self.assertEqual(r["minutos_do_dia"], 60)
        self.assertEqual(r["sessoes_do_dia"], 2)


class SequenciaEmRisco(CasoBase):
    """A faixa do topo: o que está em jogo, nunca o que foi falhado."""

    def test_corrida_de_pe_sem_estudar_hoje_esta_em_risco(self):
        for dias in (1, 2, 3):
            self.criar_sessao(dias_atras=dias, minutos=30)
        d = resumo_da_sequencia()
        self.assertTrue(d["dias"])
        self.assertFalse(d["estudou_hoje"])
        self.assertTrue(d["em_risco"])

    def test_dia_cumprido_nao_esta_em_risco(self):
        self.criar_sessao(dias_atras=1, minutos=30)
        self.criar_sessao(dias_atras=0, minutos=30)
        self.assertFalse(resumo_da_sequencia()["em_risco"])

    def test_sem_corrida_nao_ha_o_que_perder(self):
        """Quem está voltando não é cobrado justamente no dia em que voltou."""
        self.assertFalse(resumo_da_sequencia()["em_risco"])


class Marcos(CasoBase):
    """Fatos raros, ditos uma vez. Nenhum deles é farmável."""

    def test_primeiro_dominado_da_materia_e_um_marco(self):
        self.topico.status = Topico.DOMINADO
        self.topico.save()
        chaves = marcos_de_agora()
        self.assertIn(f"dominado:{self.materia.id}", chaves)

    def test_intervalo_longo_e_um_marco(self):
        self.topico.intervalo_dias = 120
        self.topico.save()
        self.assertIn(f"intervalo_longo:{self.topico.id}", marcos_de_agora())

    def test_intervalo_curto_nao_e(self):
        self.topico.intervalo_dias = 30
        self.topico.save()
        self.assertNotIn(f"intervalo_longo:{self.topico.id}", marcos_de_agora())

    def test_dias_seguidos_passam_pelo_degrau(self):
        for dias in range(8):
            self.criar_sessao(dias_atras=dias, minutos=30)
        self.assertIn("dias_7", marcos_de_agora())
        self.assertNotIn("dias_30", marcos_de_agora())

    def test_a_primeira_passada_semeia_em_silencio(self):
        """Um ano de histórico não rende trinta parabéns de uma vez."""
        self.topico.status = Topico.DOMINADO
        self.topico.intervalo_dias = 200
        self.topico.save()

        self.assertEqual(marcos_novos(), [])
        self.assertTrue(Marco.objects.exists())

    def test_depois_de_semeado_o_marco_novo_e_anunciado(self):
        self.topico.status = Topico.DOMINADO
        self.topico.save()
        marcos_novos()  # semeia

        outra = self.criar_topico("Integrais", materia=self.materia)
        outra.intervalo_dias = 100
        outra.save()

        novos = marcos_novos()
        self.assertEqual([m["chave"] for m in novos], [f"intervalo_longo:{outra.id}"])

    def test_perfil_sem_marco_nenhum_nao_engole_o_primeiro(self):
        """A semeadura é um fato gravado, não a ausência de linhas.

        Um perfil novo não tem marco de verdade nenhum. Se "primeira passada"
        fosse inferida do vazio, a passada que *descobre* o primeiro marco dele
        seria tratada como semeadura -- e o parabéns se perderia uma vez só, e
        para sempre.
        """
        self.assertEqual(marcos_novos(), [])  # nada a semear, mas semeia a marca

        self.topico.status = Topico.DOMINADO
        self.topico.save()
        titulos = [m["titulo"] for m in marcos_novos()]
        self.assertEqual(len(titulos), 1)
        self.assertIn("Cálculo", titulos[0])

    def test_a_marca_da_semeadura_nunca_e_anunciada(self):
        marcos_novos()
        self.assertNotIn("_semeado", marcos_de_agora())
        self.assertTrue(Marco.objects.filter(chave="_semeado").exists())

    def test_nao_anuncia_o_mesmo_marco_duas_vezes(self):
        self.topico.status = Topico.DOMINADO
        self.topico.save()
        marcos_novos()
        outra = self.criar_topico("Integrais")
        outra.intervalo_dias = 100
        outra.save()
        self.assertTrue(marcos_novos())
        self.assertEqual(marcos_novos(), [])

    def test_materia_que_volta_depois_de_parada_e_um_marco(self):
        self.configurar(dias_materia_parada=7)
        self.criar_sessao(dias_atras=40, minutos=30)
        marcos_novos()  # semeia sem a retomada: a sessao de hoje ainda nao existe

        self.criar_sessao(dias_atras=0, minutos=30)
        titulos = [m["titulo"] for m in marcos_novos()]
        self.assertIn("Cálculo voltou", titulos)

    def test_materia_estudada_ontem_nao_e_retomada(self):
        self.configurar(dias_materia_parada=7)
        self.criar_sessao(dias_atras=1, minutos=30)
        self.criar_sessao(dias_atras=0, minutos=30)
        chaves = [c for c in marcos_de_agora() if c.startswith("retomada:")]
        self.assertEqual(chaves, [])

    def test_marco_de_um_perfil_nao_vale_para_o_outro(self):
        self.topico.status = Topico.DOMINADO
        self.topico.save()
        marcos_novos()

        outro = self.criar_perfil("Outra")
        self.entrar(outro)
        self.assertEqual(Marco.objects.count(), 0)


class Lembrete(CasoBase):
    """O gatilho de fora da tela. Fala do que está em jogo, não do que faltou."""

    def test_desligado_por_padrao(self):
        self.assertFalse(dados_lembrete()["ativo"])

    def test_quem_ja_estudou_hoje_nao_tem_o_que_ser_lembrado(self):
        self.criar_sessao(dias_atras=0, minutos=30)
        d = dados_lembrete()
        self.assertFalse(d["vale_lembrar"])

    def test_o_texto_diz_a_corrida_e_a_fila(self):
        self.configurar(maximo_revisoes_por_dia=10)
        for dias in (1, 2, 3):
            self.criar_sessao(dias_atras=dias, minutos=30)
        Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)

        d = dados_lembrete()
        self.assertTrue(d["vale_lembrar"])
        self.assertIn("dias seguidos", d["texto"])
        self.assertIn("revisão", d["texto"])
        # Nada de cobrança: o texto não fala do que não foi feito.
        self.assertNotIn("não estudou", d["texto"])

    def test_dia_sem_fila_ainda_convida(self):
        d = dados_lembrete()
        self.assertTrue(d["vale_lembrar"])
        self.assertIn("pomodoro", d["texto"])

    def test_a_hora_vem_do_bloco_de_hoje_no_planner(self):
        self.criar_bloco(dia=self.hoje.weekday(), inicio="14:30", fim="16:00")
        self.assertEqual(horario_de_estudo(), "14:30")

    def test_sem_planner_a_hora_vem_do_habito(self):
        agora = timezone.localtime()
        esperado = agora.replace(hour=21, minute=15)
        SessaoEstudo.objects.create(
            topico=self.topico, inicio=esperado, duracao_min=30
        )
        self.assertEqual(horario_de_estudo(), "21:00")

    def test_sem_nada_cai_no_padrao(self):
        self.assertEqual(horario_de_estudo(), "19:00")

    def test_hora_escolhida_a_mao_manda(self):
        self.criar_bloco(dia=self.hoje.weekday(), inicio="08:00", fim="10:00")
        self.configurar(lembrete_hora="06:30")
        d = dados_lembrete()
        self.assertEqual(d["hora"], "06:30")
        self.assertFalse(d["automatico"])


class ApiDoHabito(CasoBase):
    """As portas que o front usa."""

    def test_dashboard_traz_investimento_e_lembrete(self):
        self.criar_sessao(minutos=60)
        d = self.client.get("/api/dashboard/").json()
        self.assertEqual(d["investimento"]["horas"], 1.0)
        self.assertIn("hora", d["lembrete"])

    def test_marcos_e_post_e_so_anuncia_uma_vez(self):
        self.topico.status = Topico.DOMINADO
        self.topico.save()
        self.assertEqual(self.post("/api/marcos/").json()["marcos"], [])  # semeia

        outra = self.criar_topico("Integrais")
        outra.intervalo_dias = 100
        outra.save()
        self.assertEqual(len(self.post("/api/marcos/").json()["marcos"]), 1)
        self.assertEqual(self.post("/api/marcos/").json()["marcos"], [])

    def test_marcos_recusa_get(self):
        """Ler a tela não pode gastar o "já falei disso"."""
        self.assertEqual(self.client.get("/api/marcos/").status_code, 405)

    def test_sessao_salva_devolve_o_resumo(self):
        self.configurar(meta_horas_semanais=4)
        d = self.post(
            "/api/sessoes/criar/",
            {"topico_id": self.topico.id, "duracao_min": 60, "interrupcoes": 2},
        ).json()
        self.assertEqual(d["resumo"]["minutos"], 60)
        self.assertEqual(d["resumo"]["interrupcoes"], 2)
        self.assertEqual(d["resumo"]["percentual_meta"], 25)

    def test_salvar_o_lembrete_nas_configuracoes(self):
        d = self.post(
            "/api/configuracoes/salvar/",
            {"lembrete_ativo": True, "lembrete_hora": "20:45"},
        ).json()
        self.assertTrue(d["configuracao"]["lembrete_ativo"])
        self.assertEqual(d["configuracao"]["lembrete_hora"], "20:45")

    def test_hora_vazia_volta_a_ser_automatica(self):
        self.configurar(lembrete_hora="20:00")
        d = self.post("/api/configuracoes/salvar/", {"lembrete_hora": ""}).json()
        self.assertEqual(d["configuracao"]["lembrete_hora"], "")
        self.assertTrue(dados_lembrete()["automatico"])

    def test_hora_torta_e_recusada_com_mensagem(self):
        resposta = self.post("/api/configuracoes/salvar/", {"lembrete_hora": "25h"})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("19:00", resposta.json()["erro"])

    def test_api_do_lembrete_responde(self):
        d = self.client.get("/api/lembrete/").json()
        self.assertIn("texto", d)
        self.assertIn("hora", d)
