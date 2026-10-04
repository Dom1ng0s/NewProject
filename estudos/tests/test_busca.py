"""Notas e material no tópico, e a busca global."""

import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

from estudos.models import Avaliacao, BlocoPlanejado, Cartao, Material, Materia, Topico
from estudos.views import recorte

from .base import CasoBase

ARQUIVOS = tempfile.mkdtemp()


class NotasDoTopico(CasoBase):
    def test_salvar_notas(self):
        resposta = self.post(
            f"/api/topicos/{self.topico.id}/editar/", {"notas": "  limite é tendência  "}
        )
        self.assertEqual(resposta.status_code, 200)
        self.topico.refresh_from_db()
        self.assertEqual(self.topico.notas, "limite é tendência")

    def test_notas_vao_no_json_do_topico(self):
        self.topico.notas = "resumo"
        self.topico.save()
        dados = self.client.get("/api/topicos/").json()
        self.assertEqual(dados["topicos"][0]["notas"], "resumo")

    def test_limpar_as_notas(self):
        self.topico.notas = "algo"
        self.topico.save()
        self.post(f"/api/topicos/{self.topico.id}/editar/", {"notas": ""})
        self.topico.refresh_from_db()
        self.assertEqual(self.topico.notas, "")

    def test_renomear_nao_apaga_as_notas(self):
        self.topico.notas = "fica"
        self.topico.save()
        self.post(f"/api/topicos/{self.topico.id}/editar/", {"nome": "Limites e continuidade"})
        self.topico.refresh_from_db()
        self.assertEqual(self.topico.notas, "fica")
        self.assertEqual(self.topico.nome, "Limites e continuidade")


@override_settings(MEDIA_ROOT=ARQUIVOS)
class MaterialDoTopico(CasoBase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(ARQUIVOS, ignore_errors=True)
        super().tearDownClass()

    def test_guardar_um_link(self):
        resposta = self.post(
            "/api/materiais/criar/",
            {
                "topico_id": self.topico.id,
                "titulo": "Khan Academy",
                "url": "https://pt.khanacademy.org/limites",
                "nota": "capítulo 2",
            },
        )
        self.assertEqual(resposta.status_code, 200)
        material = Material.objects.get()
        self.assertEqual(material.tipo, "link")
        self.assertEqual(material.endereco, "https://pt.khanacademy.org/limites")
        self.assertEqual(material.nota, "capítulo 2")

    def test_guardar_um_arquivo(self):
        arquivo = SimpleUploadedFile("resumo.pdf", b"%PDF-1.4 conteudo", "application/pdf")
        resposta = self.client.post(
            "/api/materiais/criar/",
            {"topico_id": self.topico.id, "titulo": "Resumo", "arquivo": arquivo},
        )
        self.assertEqual(resposta.status_code, 200)
        material = Material.objects.get()
        self.assertEqual(material.tipo, "arquivo")
        self.assertIn("resumo", material.arquivo.name)
        self.assertTrue(resposta.json()["material"]["nome_do_arquivo"])

    def test_sem_link_e_sem_arquivo_e_recusado(self):
        resposta = self.post("/api/materiais/criar/", {"topico_id": self.topico.id, "titulo": "X"})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("link", resposta.json()["erro"])
        self.assertEqual(Material.objects.count(), 0)

    def test_link_sem_esquema_e_recusado(self):
        resposta = self.post(
            "/api/materiais/criar/", {"topico_id": self.topico.id, "url": "khanacademy.org"}
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("http", resposta.json()["erro"])

    def test_link_e_arquivo_juntos_sao_recusados(self):
        arquivo = SimpleUploadedFile("a.pdf", b"x", "application/pdf")
        resposta = self.client.post(
            "/api/materiais/criar/",
            {"topico_id": self.topico.id, "url": "https://x.com", "arquivo": arquivo},
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("não os dois", resposta.json()["erro"])

    @override_settings(MATERIAL_MAXIMO_BYTES=10)
    def test_arquivo_grande_demais_e_recusado(self):
        arquivo = SimpleUploadedFile("grande.pdf", b"x" * 50, "application/pdf")
        resposta = self.client.post(
            "/api/materiais/criar/", {"topico_id": self.topico.id, "arquivo": arquivo}
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("maior", resposta.json()["erro"])
        self.assertEqual(Material.objects.count(), 0)

    def test_sem_titulo_usa_o_proprio_link(self):
        self.post(
            "/api/materiais/criar/", {"topico_id": self.topico.id, "url": "https://x.com/aula"}
        )
        self.assertEqual(Material.objects.get().titulo, "https://x.com/aula")

    def test_excluir(self):
        material = Material.objects.create(
            topico=self.topico, titulo="X", url="https://x.com"
        )
        self.post(f"/api/materiais/{material.id}/excluir/")
        self.assertEqual(Material.objects.count(), 0)

    def test_listar_filtra_por_topico(self):
        outro = self.criar_topico("Derivadas")
        Material.objects.create(topico=self.topico, titulo="A", url="https://a.com")
        Material.objects.create(topico=outro, titulo="B", url="https://b.com")
        dados = self.client.get(f"/api/materiais/?topico_id={self.topico.id}").json()
        self.assertEqual([m["titulo"] for m in dados["materiais"]], ["A"])

    def test_excluir_o_topico_leva_o_material(self):
        Material.objects.create(topico=self.topico, titulo="X", url="https://x.com")
        self.topico.delete()
        self.assertEqual(Material.objects.count(), 0)


class Recorte(CasoBase):
    def test_mostra_o_pedaco_em_volta_do_termo(self):
        texto = "a" * 100 + "achado" + "b" * 100
        saida = recorte(texto, "achado")
        self.assertIn("achado", saida)
        self.assertTrue(saida.startswith("…"))
        self.assertTrue(saida.endswith("…"))

    def test_texto_curto_sai_inteiro(self):
        self.assertEqual(recorte("curto", "curto"), "curto")

    def test_termo_ausente_devolve_o_comeco(self):
        self.assertTrue(recorte("a" * 200, "zzz").startswith("aaa"))


class BuscaGlobal(CasoBase):
    def buscar(self, termo):
        return self.client.get(f"/api/busca/?q={termo}").json()

    def grupos(self, dados):
        return {g["nome"]: g["itens"] for g in dados["grupos"]}

    def test_termo_curto_nao_busca(self):
        dados = self.buscar("a")
        self.assertEqual(dados["total"], 0)
        self.assertEqual(dados["grupos"], [])

    def test_acha_materia(self):
        grupos = self.grupos(self.buscar("cálc"))
        self.assertEqual([i["titulo"] for i in grupos["Matérias"]], ["Cálculo"])

    def test_acha_topico_pelo_nome(self):
        grupos = self.grupos(self.buscar("limi"))
        self.assertEqual([i["titulo"] for i in grupos["Tópicos"]], ["Limites"])
        self.assertEqual(grupos["Tópicos"][0]["detalhe"], "Cálculo")

    def test_acha_topico_pelas_notas_e_mostra_o_trecho(self):
        self.topico.notas = "o teorema do confronto resolve o limite do seno"
        self.topico.save()
        grupos = self.grupos(self.buscar("confronto"))
        self.assertIn("confronto", grupos["Tópicos"][0]["detalhe"])

    def test_acha_cartao_pelos_dois_lados(self):
        Cartao.objects.create(topico=self.topico, frente="O que é derivada?", verso="taxa")
        self.assertIn("Cartões", self.grupos(self.buscar("derivada")))
        self.assertIn("Cartões", self.grupos(self.buscar("taxa")))

    def test_acha_material_e_marca_como_externo(self):
        Material.objects.create(
            topico=self.topico, titulo="Apostila de limites", url="https://x.com/a.pdf"
        )
        item = self.grupos(self.buscar("apostila"))["Material"][0]
        self.assertTrue(item["externo"])
        self.assertEqual(item["url"], "https://x.com/a.pdf")

    def test_acha_avaliacao(self):
        Avaliacao.objects.create(materia=self.materia, titulo="P1 de cálculo", data=self.hoje)
        grupos = self.grupos(self.buscar("P1"))
        self.assertEqual(grupos["Provas e prazos"][0]["titulo"], "P1 de cálculo")

    def test_acha_nota_de_sessao(self):
        sessao = self.criar_sessao(minutos=30)
        sessao.nota = "travei na regra da cadeia"
        sessao.save()
        grupos = self.grupos(self.buscar("cadeia"))
        self.assertIn("cadeia", grupos["Notas de sessão"][0]["titulo"])

    def test_acha_bloco_do_planner(self):
        BlocoPlanejado.objects.create(
            titulo="Monitoria de cálculo",
            dia_semana=0,
            hora_inicio="08:00",
            hora_fim="09:00",
        )
        self.assertIn("Planner", self.grupos(self.buscar("monitoria")))

    def test_acento_nao_atrapalha(self):
        # Digitar "calculo" tem de achar "Cálculo", e vice-versa.
        self.assertEqual(
            [i["titulo"] for i in self.grupos(self.buscar("calculo"))["Matérias"]], ["Cálculo"]
        )
        self.assertEqual(
            [i["titulo"] for i in self.grupos(self.buscar("cálculo"))["Matérias"]], ["Cálculo"]
        )

    def test_maiuscula_nao_atrapalha(self):
        self.assertEqual(self.buscar("CÁLCULO")["total"], self.buscar("cálculo")["total"])

    def test_acento_tambem_vale_para_as_notas(self):
        self.topico.notas = "regra da cadeia e composição"
        self.topico.save()
        grupos = self.grupos(self.buscar("composicao"))
        self.assertIn("composição", grupos["Tópicos"][0]["detalhe"])

    def test_nada_encontrado(self):
        dados = self.buscar("xyzw")
        self.assertEqual(dados["total"], 0)
        self.assertEqual(dados["termo"], "xyzw")

    def test_um_termo_pode_cair_em_varios_grupos(self):
        Cartao.objects.create(topico=self.topico, frente="Limites laterais", verso="x")
        Avaliacao.objects.create(materia=self.materia, titulo="Prova de limites", data=self.hoje)
        grupos = self.grupos(self.buscar("limite"))
        self.assertEqual(
            sorted(grupos), ["Cartões", "Provas e prazos", "Tópicos"]
        )

    def test_cada_grupo_tem_teto(self):
        outra = Materia.objects.create(nome="Repetida")
        for i in range(12):
            Topico.objects.create(materia=outra, nome=f"Assunto repetido {i}")
        grupos = self.grupos(self.buscar("repetido"))
        self.assertEqual(len(grupos["Tópicos"]), 8)

    def test_api_nao_aceita_post(self):
        self.assertEqual(self.client.post("/api/busca/").status_code, 405)
