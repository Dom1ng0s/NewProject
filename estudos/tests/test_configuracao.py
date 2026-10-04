"""Ajustes no banco, tela de configurações e o teto diário de revisões."""

from datetime import timedelta

from estudos import backup
from estudos.models import Configuracao, Materia, Revisao, Topico, dia_com_vaga

from .base import CasoBase


class Singleton(CasoBase):
    def test_sempre_a_mesma_linha(self):
        primeira = Configuracao.atual()
        primeira.meta_horas_semanais = 20
        primeira.save()
        self.assertEqual(Configuracao.atual().meta_horas_semanais, 20)
        self.assertEqual(Configuracao.objects.count(), 1)

    def test_salvar_outra_instancia_nao_cria_uma_segunda(self):
        Configuracao.atual()
        Configuracao(meta_horas_semanais=99).save()
        self.assertEqual(Configuracao.objects.count(), 1)
        self.assertEqual(Configuracao.atual().meta_horas_semanais, 99)

    def test_padroes_de_fabrica(self):
        config = Configuracao.atual()
        self.assertEqual(config.primeiro_intervalo_dias, 1)
        self.assertEqual(config.segundo_intervalo_dias, 6)
        self.assertEqual(config.maximo_revisoes_por_dia, 10)
        self.assertEqual(config.pomodoro_foco_min, 25)

    def test_json_traz_todos_os_campos_menos_o_id(self):
        dados = Configuracao.atual().json()
        self.assertNotIn("id", dados)
        self.assertIn("facilidade_minima", dados)


class TetoDiario(CasoBase):
    def lotar(self, data, quantos):
        for i in range(quantos):
            topico = self.criar_topico(f"Enchendo {i}")
            Revisao.objects.create(topico=topico, data_prevista=data)

    def test_dia_vazio_e_o_proprio_dia(self):
        self.assertEqual(dia_com_vaga(self.hoje, 10), self.hoje)

    def test_dia_cheio_escorrega_para_o_seguinte(self):
        self.lotar(self.hoje, 10)
        self.assertEqual(dia_com_vaga(self.hoje, 10), self.hoje + timedelta(days=1))

    def test_escorrega_quantos_dias_forem_precisos(self):
        self.lotar(self.hoje, 10)
        self.lotar(self.hoje + timedelta(days=1), 10)
        self.assertEqual(dia_com_vaga(self.hoje, 10), self.hoje + timedelta(days=2))

    def test_limite_zero_desliga_o_teto(self):
        self.lotar(self.hoje, 30)
        self.assertEqual(dia_com_vaga(self.hoje, 0), self.hoje)

    def test_revisao_ja_feita_nao_ocupa_vaga(self):
        for i in range(10):
            topico = self.criar_topico(f"Feito {i}")
            Revisao.objects.create(topico=topico, data_prevista=self.hoje, feita=True)
        self.assertEqual(dia_com_vaga(self.hoje, 10), self.hoje)

    def test_o_proprio_topico_nao_conta_como_ocupante(self):
        self.lotar(self.hoje, 9)
        Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        self.assertEqual(dia_com_vaga(self.hoje, 10, self.topico), self.hoje)

    def test_agendar_respeita_o_teto(self):
        self.configurar(maximo_revisoes_por_dia=2)
        amanha = self.hoje + timedelta(days=1)
        self.lotar(amanha, 2)

        self.topico.agendar(1)
        self.assertEqual(
            Revisao.objects.get(topico=self.topico).data_prevista,
            amanha + timedelta(days=1),
        )

    def test_responder_nao_perde_a_escada_quando_escorrega(self):
        self.configurar(maximo_revisoes_por_dia=1)
        self.lotar(self.hoje + timedelta(days=1), 1)

        self.topico.responder(4)
        # O intervalo continua 1 dia; só a data da revisão andou.
        self.assertEqual(self.topico.intervalo_dias, 1)
        self.assertEqual(
            Revisao.objects.get(topico=self.topico).data_prevista,
            self.hoje + timedelta(days=2),
        )


class FilaCortada(CasoBase):
    def encher_a_fila(self, quantas, atrasadas=0):
        for i in range(quantas):
            topico = self.criar_topico(f"Tópico {i}")
            dia = self.hoje - timedelta(days=1) if i < atrasadas else self.hoje
            Revisao.objects.create(topico=topico, data_prevista=dia)

    def fila(self):
        return self.client.get("/api/revisoes/hoje/").json()

    def test_fila_curta_vem_inteira(self):
        self.encher_a_fila(4)
        dados = self.fila()
        self.assertEqual(len(dados["fila"]), 4)
        self.assertEqual(dados["esperando"], 0)

    def test_fila_longa_e_cortada_no_teto(self):
        self.configurar(maximo_revisoes_por_dia=5)
        self.encher_a_fila(12)
        dados = self.fila()
        self.assertEqual(len(dados["fila"]), 5)
        self.assertEqual(dados["esperando"], 7)
        self.assertEqual(dados["maximo_por_dia"], 5)

    def test_o_corte_pega_as_atrasadas_tambem(self):
        self.configurar(maximo_revisoes_por_dia=3)
        self.encher_a_fila(6, atrasadas=4)
        dados = self.fila()
        self.assertEqual(len(dados["fila"]), 3)
        self.assertEqual(dados["atrasadas"], 4)
        self.assertEqual(dados["hoje"], 2)

    def test_teto_zero_mostra_tudo(self):
        self.configurar(maximo_revisoes_por_dia=0)
        self.encher_a_fila(15)
        self.assertEqual(len(self.fila()["fila"]), 15)

    def test_o_que_cai_em_prova_fica_dentro_do_corte(self):
        from estudos.models import Avaliacao

        self.configurar(maximo_revisoes_por_dia=1)
        self.encher_a_fila(5)
        urgente = Topico.objects.get(nome="Tópico 4")
        avaliacao = Avaliacao.objects.create(
            materia=self.materia, titulo="P1", data=self.hoje + timedelta(days=1)
        )
        avaliacao.topicos.set([urgente])

        dados = self.fila()
        self.assertEqual([r["topico"] for r in dados["fila"]], ["Tópico 4"])


class TelaDeConfiguracoes(CasoBase):
    def salvar(self, **campos):
        return self.post("/api/configuracoes/salvar/", campos)

    def test_tela_abre(self):
        self.assertEqual(self.client.get("/configuracoes/").status_code, 200)

    def test_api_devolve_os_ajustes(self):
        dados = self.client.get("/api/configuracoes/").json()
        self.assertEqual(dados["configuracao"]["pomodoro_ciclos"], 4)

    def test_salvar_muda_o_comportamento_do_app(self):
        resposta = self.salvar(meta_horas_semanais=20, pomodoro_foco_min=50)
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(self.config.meta_horas_semanais, 20)
        self.assertEqual(
            self.client.get("/sessao/").context["pomodoro_foco"], 50
        )

    def test_salvar_parcial_nao_mexe_no_resto(self):
        self.configurar(pomodoro_foco_min=40)
        self.salvar(meta_horas_semanais=15)
        self.assertEqual(self.config.pomodoro_foco_min, 40)

    def test_valor_fora_da_faixa_e_recusado(self):
        resposta = self.salvar(pomodoro_foco_min=999)
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("entre", resposta.json()["erro"])
        self.assertEqual(self.config.pomodoro_foco_min, 25)

    def test_texto_no_lugar_do_numero_e_recusado(self):
        resposta = self.salvar(meta_horas_semanais="muitas")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("número", resposta.json()["erro"])

    def test_segundo_intervalo_tem_de_passar_o_primeiro(self):
        resposta = self.salvar(primeiro_intervalo_dias=6, segundo_intervalo_dias=3)
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("segundo intervalo", resposta.json()["erro"])
        self.assertEqual(self.config.primeiro_intervalo_dias, 1)

    def test_teto_nao_pode_ser_menor_que_o_segundo_intervalo(self):
        resposta = self.salvar(segundo_intervalo_dias=30, intervalo_maximo_dias=10)
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("teto", resposta.json()["erro"])

    def test_teto_de_revisoes_pode_ser_zero(self):
        self.assertEqual(self.salvar(maximo_revisoes_por_dia=0).status_code, 200)
        self.assertEqual(self.config.maximo_revisoes_por_dia, 0)

    def test_restaurar_volta_ao_padrao(self):
        self.configurar(meta_horas_semanais=99, pomodoro_foco_min=90)
        resposta = self.salvar(restaurar=True)
        self.assertEqual(resposta.json()["configuracao"]["meta_horas_semanais"], 10)
        self.assertEqual(self.config.pomodoro_foco_min, 25)
        self.assertEqual(Configuracao.objects.count(), 1)

    def test_api_nao_aceita_get_no_salvar(self):
        self.assertEqual(self.client.get("/api/configuracoes/salvar/").status_code, 405)


class ConfiguracaoNoBackup(CasoBase):
    def test_os_ajustes_vao_e_voltam(self):
        self.configurar(meta_horas_semanais=22, maximo_revisoes_por_dia=3)
        arquivo = backup.exportar()
        self.assertEqual(arquivo["configuracao"]["meta_horas_semanais"], 22)

        self.configurar(meta_horas_semanais=10, maximo_revisoes_por_dia=10)
        resumo = backup.importar(arquivo)
        self.assertTrue(resumo["ajustes"])
        self.assertEqual(self.config.meta_horas_semanais, 22)
        self.assertEqual(self.config.maximo_revisoes_por_dia, 3)

    def test_backup_antigo_sem_ajustes_nao_mexe_neles(self):
        self.configurar(meta_horas_semanais=33)
        arquivo = {
            "app": "estudos",
            "versao": 5,
            "materias": [{"id": 1, "nome": "Física"}],
        }
        resumo = backup.importar(arquivo)
        self.assertFalse(resumo["ajustes"])
        self.assertEqual(self.config.meta_horas_semanais, 33)
        self.assertTrue(Materia.objects.filter(nome="Física").exists())

    def test_secao_em_formato_errado_e_recusada(self):
        arquivo = {"app": "estudos", "versao": backup.VERSAO, "configuracao": [1, 2]}
        with self.assertRaises(ValueError) as contexto:
            backup.importar(arquivo)
        self.assertIn("objeto", str(contexto.exception))
