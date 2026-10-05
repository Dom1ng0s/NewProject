"""/agora/: a URL que abre o app com o trabalho já começado.

O que se testa aqui é a ordem da decisão, porque é ela que define se abrir o
app no celular cai na revisão (fila de ônibus) ou na sessão (hora do bloco).
"""

from datetime import timedelta

from estudos.models import Revisao

from .base import CasoBase
from .test_continuar import momento


class IrParaAgora(CasoBase):
    def test_sem_nada_cai_no_dashboard(self):
        resposta = self.client.get("/agora/")
        self.assertRedirects(resposta, "/")

    def test_com_sessao_anterior_vai_para_a_sessao_ja_contando(self):
        self.criar_sessao(topico=self.topico)
        resposta = self.client.get("/agora/")
        destino = resposta["Location"]
        self.assertIn("/sessao/", destino)
        self.assertIn(f"topico_id={self.topico.id}", destino)
        self.assertIn("iniciar=1", destino)

    def test_sem_sessao_mas_com_fila_vai_revisar_ja_abrindo(self):
        Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        resposta = self.client.get("/agora/")
        self.assertRedirects(resposta, "/revisar/?iniciar=1")

    def test_a_fila_ganha_da_ultima_sessao(self):
        # Sem bloco cobrindo a hora, o que tem data marcada vem primeiro: a
        # revisao vence hoje, a sessao pode ser a qualquer momento.
        self.criar_sessao(topico=self.topico)
        Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        self.assertRedirects(self.client.get("/agora/"), "/revisar/?iniciar=1")

    def test_a_revisao_de_amanha_nao_desvia_ninguem(self):
        self.criar_sessao(topico=self.topico)
        Revisao.objects.create(
            topico=self.topico, data_prevista=self.hoje + timedelta(days=1)
        )
        self.assertIn("/sessao/", self.client.get("/agora/")["Location"])

    def test_a_fila_sozinha_nao_segura_quem_tem_bloco_agora(self):
        # O bloco do planner cobre esta hora: a agenda ja decidiu o que e agora.
        agora = momento(9)
        self.criar_sessao(topico=self.topico)
        Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        self.criar_bloco(
            dia=agora.weekday(), inicio="00:00", fim="23:59", topico=self.topico
        )
        self.assertIn("/sessao/", self.client.get("/agora/")["Location"])

    def test_a_tela_de_revisao_aceita_iniciar(self):
        self.assertEqual(self.client.get("/revisar/?iniciar=1").status_code, 200)
