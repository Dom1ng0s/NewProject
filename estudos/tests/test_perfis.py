"""Perfis: quem está estudando, e a parede entre um e outro.

O que mais importa aqui não é a tela de escolha: é o isolamento. Um app que
mostra a matéria de outra pessoa não avisa que errou -- ele simplesmente mostra,
e só quem conhece os próprios dados percebe. Por isso a maior parte destes
testes pergunta a mesma coisa de ângulos diferentes: o perfil B enxerga algo do
perfil A?
"""

import io
from datetime import timedelta

from django.utils import timezone

from estudos import escopo
from estudos.models import (
    Avaliacao,
    BlocoPlanejado,
    Cartao,
    Configuracao,
    Materia,
    Perfil,
    Revisao,
    SessaoEstudo,
    Topico,
)

from .base import CasoBase


def imagem_png():
    """Um PNG mínimo de verdade: o que `fotos.conferir` aceita pelos bytes."""
    import struct
    import zlib

    def bloco(tipo, dados):
        corpo = tipo + dados
        return (
            struct.pack(">I", len(dados))
            + corpo
            + struct.pack(">I", zlib.crc32(corpo) & 0xFFFFFFFF)
        )

    cru = zlib.compress(b"\x00\xff\x00\x00", 9)
    conteudo = (
        b"\x89PNG\r\n\x1a\n"
        + bloco(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
        + bloco(b"IDAT", cru)
        + bloco(b"IEND", b"")
    )
    arquivo = io.BytesIO(conteudo)
    arquivo.name = "foto.png"
    return arquivo


class TelaDeEscolha(CasoBase):
    def test_abre_sem_perfil_escolhido(self):
        self.client.cookies.clear()
        resposta = self.client.get("/perfis/")
        self.assertEqual(resposta.status_code, 200)
        self.assertContains(resposta, "Quem está estudando?")

    def test_a_tela_ja_vem_com_os_perfis_dentro(self):
        """Sem isso a grade pisca vazia antes do primeiro fetch."""
        self.criar_perfil("Ana")
        corpo = self.client.get("/perfis/").content.decode()
        self.assertIn("Ana", corpo)

    def test_a_api_lista_e_diz_quem_e_o_atual(self):
        dados = self.client.get("/api/perfis/").json()
        self.assertEqual([p["nome"] for p in dados["perfis"]], ["Eu"])
        self.assertEqual(dados["atual"], self.perfil.id)


class Middleware(CasoBase):
    def test_sem_perfil_toda_tela_desvia_para_a_escolha(self):
        self.client.cookies.clear()
        resposta = self.client.get("/materias/")
        self.assertEqual(resposta.status_code, 302)
        self.assertIn("/perfis/", resposta["Location"])

    def test_o_desvio_lembra_para_onde_a_pessoa_ia(self):
        self.client.cookies.clear()
        resposta = self.client.get("/historico/")
        self.assertIn("proximo=", resposta["Location"])
        self.assertIn("historico", resposta["Location"])

    def test_cookie_apontando_para_perfil_apagado_nao_entra(self):
        self.client.cookies["perfil"] = "99999"
        self.assertEqual(self.client.get("/").status_code, 302)

    def test_a_api_responde_erro_legivel_em_vez_de_html(self):
        """Um redirect para HTML chegando onde se espera JSON vira erro de parse."""
        self.client.cookies.clear()
        resposta = self.client.get("/api/dashboard/")
        self.assertEqual(resposta.status_code, 409)
        self.assertIn("perfil", resposta.json()["erro"].lower())

    def test_a_tela_de_escolha_e_os_estaticos_passam_sem_perfil(self):
        self.client.cookies.clear()
        for url in ("/perfis/", "/api/perfis/", "/sw.js"):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_entrar_guarda_o_cookie(self):
        outro = self.criar_perfil("Ana")
        self.client.cookies.clear()
        resposta = self.client.post(f"/api/perfis/{outro.id}/entrar/")
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.cookies["perfil"].value, str(outro.id))

    def test_sair_apaga_o_cookie(self):
        resposta = self.client.post("/api/perfis/sair/")
        self.assertEqual(resposta.cookies["perfil"].value, "")


class CriarEEditar(CasoBase):
    def test_cria_com_nome_e_cor(self):
        resposta = self.post(
            "/api/perfis/criar/", {"nome": "Ana", "cor": Perfil.CORES[1]}
        )
        self.assertEqual(resposta.status_code, 200)
        perfil = Perfil.objects.get(nome="Ana")
        self.assertEqual(perfil.cor, Perfil.CORES[1])
        self.assertEqual(perfil.inicial, "A")

    def test_nome_vazio_e_recusado(self):
        self.assertEqual(self.post("/api/perfis/criar/", {"nome": "  "}).status_code, 400)

    def test_nome_repetido_e_recusado_sem_olhar_maiuscula(self):
        resposta = self.post("/api/perfis/criar/", {"nome": "eu"})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("Já existe", resposta.json()["erro"])

    def test_cor_fora_da_paleta_e_recusada(self):
        resposta = self.post("/api/perfis/criar/", {"nome": "Ana", "cor": "#123456"})
        self.assertEqual(resposta.status_code, 400)

    def test_renomear_mantendo_o_proprio_nome_funciona(self):
        """Editar sem trocar o nome não pode esbarrar no próprio registro."""
        resposta = self.post(
            f"/api/perfis/{self.perfil.id}/editar/",
            {"nome": "Eu", "cor": Perfil.CORES[2]},
        )
        self.assertEqual(resposta.status_code, 200)
        self.perfil.refresh_from_db()
        self.assertEqual(self.perfil.cor, Perfil.CORES[2])

    def test_sem_nome_a_inicial_nao_quebra(self):
        perfil = Perfil(nome="  ")
        self.assertEqual(perfil.inicial, "?")


class Foto(CasoBase):
    def test_aceita_um_png_de_verdade(self):
        resposta = self.client.post(
            "/api/perfis/criar/", {"nome": "Ana", "foto": imagem_png()}
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertTrue(Perfil.objects.get(nome="Ana").foto)

    def test_recusa_arquivo_que_nao_e_imagem(self):
        """A extensão mente; os bytes não."""
        falso = io.BytesIO(b"isto aqui nao e imagem nenhuma")
        falso.name = "foto.png"
        resposta = self.client.post(
            "/api/perfis/criar/", {"nome": "Ana", "foto": falso}
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertFalse(Perfil.objects.filter(nome="Ana").exists())

    def test_recusa_foto_grande_demais(self):
        from estudos.fotos import MAXIMO_BYTES

        grande = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * (MAXIMO_BYTES + 1))
        grande.name = "foto.png"
        resposta = self.client.post(
            "/api/perfis/criar/", {"nome": "Ana", "foto": grande}
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("MB", resposta.json()["erro"])

    def test_remover_foto_volta_para_a_inicial(self):
        self.client.post("/api/perfis/criar/", {"nome": "Ana", "foto": imagem_png()})
        ana = Perfil.objects.get(nome="Ana")
        resposta = self.client.post(
            f"/api/perfis/{ana.id}/editar/", {"nome": "Ana", "remover_foto": "1"}
        )
        self.assertEqual(resposta.status_code, 200)
        ana.refresh_from_db()
        self.assertFalse(ana.foto)

    def test_o_formato_vem_dos_bytes_e_nao_da_extensao(self):
        from estudos.fotos import formato

        enganoso = imagem_png()
        enganoso.name = "foto.jpg"
        self.assertEqual(formato(enganoso), "png")


class UmPerfilNaoVeOOutro(CasoBase):
    """A parede. Cada teste olha um modelo e pergunta a mesma coisa."""

    def setUp(self):
        super().setUp()
        self.outra = self.criar_perfil("Ana")
        with escopo.como(self.outra):
            self.materia_dela = Materia.objects.create(nome="Física", cor="#222222")
            self.topico_dela = Topico.objects.create(
                materia=self.materia_dela, nome="Ondas"
            )

    def test_materias(self):
        self.assertEqual([m.nome for m in Materia.objects.all()], ["Cálculo"])
        with escopo.como(self.outra):
            self.assertEqual([m.nome for m in Materia.objects.all()], ["Física"])

    def test_topicos(self):
        self.assertEqual([t.nome for t in Topico.objects.all()], ["Limites"])

    def test_sessoes(self):
        with escopo.como(self.outra):
            SessaoEstudo.objects.create(
                topico=self.topico_dela, inicio=timezone.now(), duracao_min=90
            )
        self.assertEqual(SessaoEstudo.objects.count(), 0)

    def test_revisoes(self):
        with escopo.como(self.outra):
            Revisao.objects.create(topico=self.topico_dela, data_prevista=self.hoje)
        self.assertEqual(Revisao.objects.count(), 0)

    def test_avaliacoes(self):
        with escopo.como(self.outra):
            Avaliacao.objects.create(
                materia=self.materia_dela, titulo="P1", data=self.hoje
            )
        self.assertEqual(Avaliacao.objects.count(), 0)

    def test_blocos_do_planner(self):
        with escopo.como(self.outra):
            self.criar_bloco(materia=self.materia_dela)
        self.assertEqual(BlocoPlanejado.objects.count(), 0)

    def test_cartoes(self):
        with escopo.como(self.outra):
            Cartao.objects.create(topico=self.topico_dela, frente="p", verso="r")
        self.assertEqual(Cartao.objects.count(), 0)

    def test_dois_perfis_podem_cursar_a_mesma_materia(self):
        """O nome é único por perfil, não no mundo."""
        with escopo.como(self.outra):
            Materia.objects.create(nome="Cálculo", cor="#333333")
        self.assertEqual(Materia.todos.filter(nome="Cálculo").count(), 2)

    def test_cada_perfil_tem_os_proprios_ajustes(self):
        config = Configuracao.atual()
        config.meta_horas_semanais = 40
        config.save()

        with escopo.como(self.outra):
            self.assertEqual(Configuracao.atual().meta_horas_semanais, 10)
        self.assertEqual(Configuracao.atual().meta_horas_semanais, 40)

    def test_o_dashboard_so_mostra_o_proprio(self):
        with escopo.como(self.outra):
            Revisao.objects.create(topico=self.topico_dela, data_prevista=self.hoje)
        dados = self.client.get("/api/dashboard/").json()
        self.assertEqual(dados["revisoes_hoje"], [])
        self.assertEqual([m["nome"] for m in dados["materias"]], ["Cálculo"])

    def test_a_arvore_so_mostra_o_proprio(self):
        materias = self.client.get("/api/arvore/").json()["materias"]
        self.assertEqual([m["nome"] for m in materias], ["Cálculo"])

    def test_a_busca_nao_atravessa_a_parede(self):
        resposta = self.client.get("/api/busca/?q=Ondas").json()
        encontrados = [item for grupo in resposta.values() if isinstance(grupo, list) for item in grupo]
        self.assertEqual(encontrados, [])

    def test_o_titulo_conta_so_as_proprias_pendentes(self):
        with escopo.como(self.outra):
            Revisao.objects.create(topico=self.topico_dela, data_prevista=self.hoje)
        self.assertIn("<title>Dashboard · ", self.client.get("/").content.decode())

    def test_o_backup_exporta_so_o_proprio(self):
        dados = self.client.get("/api/backup/exportar/").json()
        self.assertEqual([m["nome"] for m in dados["materias"]], ["Cálculo"])


class ExcluirPerfil(CasoBase):
    def setUp(self):
        super().setUp()
        self.outra = self.criar_perfil("Ana")
        with escopo.como(self.outra):
            materia = Materia.objects.create(nome="Física")
            topico = Topico.objects.create(materia=materia, nome="Ondas")
            SessaoEstudo.objects.create(
                topico=topico, inicio=timezone.now(), duracao_min=60
            )

    def test_o_resumo_diz_o_tamanho_do_estrago(self):
        resumo = self.client.get(f"/api/perfis/{self.outra.id}/resumo/").json()
        self.assertEqual(resumo["materias"], 1)
        self.assertEqual(resumo["topicos"], 1)
        self.assertEqual(resumo["sessoes"], 1)

    def test_apaga_o_perfil_e_o_que_era_dele(self):
        self.post(f"/api/perfis/{self.outra.id}/excluir/")
        self.assertFalse(Perfil.objects.filter(pk=self.outra.pk).exists())
        self.assertEqual(Materia.todos.filter(nome="Física").count(), 0)

    def test_nao_encosta_no_dado_dos_outros(self):
        self.post(f"/api/perfis/{self.outra.id}/excluir/")
        self.assertTrue(Materia.objects.filter(nome="Cálculo").exists())

    def test_excluir_o_perfil_em_uso_derruba_o_cookie(self):
        resposta = self.post(f"/api/perfis/{self.perfil.id}/excluir/")
        self.assertEqual(resposta.cookies["perfil"].value, "")


class DonoAutomatico(CasoBase):
    """Ninguém escreve `perfil=` na mão; o dono vem do pai ou do perfil atual."""

    def test_a_materia_herda_o_perfil_atual(self):
        self.assertEqual(self.materia.perfil_id, self.perfil.id)

    def test_o_topico_herda_da_materia(self):
        with escopo.como(None):
            outra = self.criar_perfil("Ana")
            materia = Materia.objects.create(nome="Física", perfil=outra)
            topico = Topico.objects.create(materia=materia, nome="Ondas")
        self.assertEqual(topico.perfil_id, outra.id)

    def test_o_cartao_herda_do_topico(self):
        cartao = Cartao.objects.create(topico=self.topico, frente="p", verso="r")
        self.assertEqual(cartao.perfil_id, self.perfil.id)

    def test_a_revisao_herda_do_topico(self):
        revisao = Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        self.assertEqual(revisao.perfil_id, self.perfil.id)

    def test_sem_perfil_e_sem_pai_o_erro_e_explicito(self):
        """Melhor estourar do que gravar uma linha órfã que some das telas."""
        with escopo.como(None):
            with self.assertRaises(ValueError):
                Materia.objects.create(nome="Órfã")

    def test_fora_de_um_request_o_manager_nao_filtra(self):
        """Sem perfil definido, ver tudo -- senão todo script viraria mistério."""
        self.criar_perfil("Ana")
        with escopo.como(None):
            self.assertEqual(Materia.objects.count(), Materia.todos.count())


class AgoraPorPerfil(CasoBase):
    def test_a_fila_de_outro_perfil_nao_desvia_o_meu_agora(self):
        outra = self.criar_perfil("Ana")
        with escopo.como(outra):
            materia = Materia.objects.create(nome="Física")
            topico = Topico.objects.create(materia=materia, nome="Ondas")
            Revisao.objects.create(topico=topico, data_prevista=self.hoje)

        # Nada meu para fazer: tem de cair no dashboard, não na fila dela.
        self.assertRedirects(self.client.get("/agora/"), "/")

    def test_com_fila_propria_vai_revisar(self):
        Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        self.assertRedirects(self.client.get("/agora/"), "/revisar/?iniciar=1")


class SemearComPerfil(CasoBase):
    def test_popular_dados_cria_o_perfil_que_recebe_o_semestre(self):
        from django.core.management import call_command

        with escopo.como(None):
            call_command("popular_dados", "--perfil", "Teste", verbosity=0)

        perfil = Perfil.objects.get(nome="Teste")
        self.assertTrue(Materia.todos.filter(perfil=perfil).exists())
        # E não encostou no perfil que já existia.
        self.assertEqual(Materia.objects.filter(nome="Cálculo").count(), 1)


class LerAjusteNaoEscreve(CasoBase):
    """Ler os ajustes não pode gravar nada.

    Era um `get_or_create`: num perfil recém-criado o primeiro carregamento do
    dashboard virava escrita, e como a tela pede duas APIs em paralelo as duas
    tentavam inserir a mesma linha -- "database is locked", dashboard em branco.
    """

    def test_perfil_novo_recebe_os_padroes_sem_criar_linha(self):
        nova = self.criar_perfil("Ana")
        with escopo.como(nova):
            config = Configuracao.atual()
            self.assertEqual(config.meta_horas_semanais, 10)
            self.assertIsNone(config.pk)
            self.assertEqual(Configuracao.objects.count(), 0)

    def test_as_telas_de_um_perfil_novo_abrem(self):
        nova = self.criar_perfil("Ana")
        self.client.cookies["perfil"] = str(nova.pk)
        for url in ("/api/dashboard/", "/api/carga/", "/api/historico/", "/api/revisoes/hoje/"):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_salvar_e_que_cria_a_linha(self):
        nova = self.criar_perfil("Ana")
        self.client.cookies["perfil"] = str(nova.pk)
        self.post("/api/configuracoes/salvar/", {"meta_horas_semanais": 15})
        with escopo.como(nova):
            self.assertEqual(Configuracao.objects.count(), 1)
            self.assertEqual(Configuracao.atual().meta_horas_semanais, 15)
