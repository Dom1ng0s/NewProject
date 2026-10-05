"""A árvore de assuntos: o que aparece primeiro na tela de tópicos."""

from estudos.models import Topico

from .base import CasoBase


class OrdemDaArvore(CasoBase):
    def setUp(self):
        super().setUp()
        self.topico.delete()  # o tópico do caso base atrapalharia a ordem
        self.criar_topico("Zebra dominada", status=Topico.DOMINADO)
        self.criar_topico("Alfa não iniciada", status=Topico.NAO_INICIADO)
        self.criar_topico("Meio revisada", status=Topico.REVISADO)
        self.criar_topico("Beta estudando", status=Topico.ESTUDANDO)

    def nomes_na_arvore(self):
        arvore = self.client.get("/api/arvore/").json()
        return [t["nome"] for t in arvore["materias"][0]["topicos"]]

    def test_o_mais_estudado_vem_primeiro(self):
        self.assertEqual(
            self.nomes_na_arvore(),
            ["Zebra dominada", "Meio revisada", "Beta estudando", "Alfa não iniciada"],
        )

    def test_dentro_do_mesmo_status_vale_o_alfabeto(self):
        self.criar_topico("Alfa estudando", status=Topico.ESTUDANDO)
        nomes = self.nomes_na_arvore()
        self.assertEqual(nomes.index("Alfa estudando"), nomes.index("Beta estudando") - 1)

    def test_os_filhos_seguem_a_mesma_ordem(self):
        pai = self.criar_topico("Pai", status=Topico.ESTUDANDO)
        self.criar_topico("Filho intocado", pai=pai, status=Topico.NAO_INICIADO)
        self.criar_topico("Filho dominado", pai=pai, status=Topico.DOMINADO)

        arvore = self.client.get("/api/arvore/").json()
        ramo = next(
            t for t in arvore["materias"][0]["topicos"] if t["nome"] == "Pai"
        )
        self.assertEqual(
            [f["nome"] for f in ramo["filhos"]], ["Filho dominado", "Filho intocado"]
        )
