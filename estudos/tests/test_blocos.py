"""A API do planner: criar, editar e excluir blocos da semana."""

from estudos.models import BlocoPlanejado

from .base import CasoBase


class CriarBloco(CasoBase):
    def dados(self, **extra):
        base = {
            "tipo": "aula",
            "titulo": "Aula de Aprendizagem de Máquina",
            "materia_id": self.materia.id,
            "dia_semana": 1,
            "hora_inicio": "17:10",
            "hora_fim": "18:50",
            "recorrente": True,
        }
        base.update(extra)
        return base

    def test_bloco_sem_topico_entra(self):
        """O tópico é opcional: a matéria já basta para dizer de que é o bloco.

        O perfil chegou a reprovar todo bloco novo aqui, porque a validação
        olhava um campo que só o save() preenche.
        """
        resposta = self.post("/api/blocos/criar/", self.dados())
        self.assertEqual(resposta.status_code, 200)

        bloco = BlocoPlanejado.objects.get()
        self.assertIsNone(bloco.topico)
        self.assertEqual(bloco.materia, self.materia)
        self.assertEqual(bloco.perfil, self.perfil)

    def test_bloco_com_topico_herda_a_materia(self):
        resposta = self.post(
            "/api/blocos/criar/", self.dados(materia_id=None, topico_id=self.topico.id)
        )
        self.assertEqual(resposta.status_code, 200)

        bloco = BlocoPlanejado.objects.get()
        self.assertEqual(bloco.topico, self.topico)
        self.assertEqual(bloco.materia, self.materia)

    def test_so_o_titulo_tambem_basta(self):
        dados = self.dados(materia_id=None, titulo="Academia")
        self.assertEqual(self.post("/api/blocos/criar/", dados).status_code, 200)
        self.assertIsNone(BlocoPlanejado.objects.get().materia)

    def test_sem_materia_e_sem_titulo_o_bloco_nao_tem_nome(self):
        dados = self.dados(materia_id=None, titulo="")
        resposta = self.post("/api/blocos/criar/", dados)
        self.assertEqual(resposta.status_code, 400)
        self.assertFalse(BlocoPlanejado.objects.exists())

    def test_fim_antes_do_inicio_nao_vale(self):
        dados = self.dados(hora_inicio="18:50", hora_fim="17:10")
        self.assertEqual(self.post("/api/blocos/criar/", dados).status_code, 400)
        self.assertFalse(BlocoPlanejado.objects.exists())

    def test_o_bloco_de_um_perfil_nao_aparece_no_outro(self):
        self.post("/api/blocos/criar/", self.dados())
        self.entrar(self.criar_perfil("Outra"))
        self.assertFalse(BlocoPlanejado.objects.exists())
