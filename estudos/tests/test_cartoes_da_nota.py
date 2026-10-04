"""A nota do tópico virando cartão: "pergunta :: resposta" e lacunas."""

from estudos.cartoes import MAXIMO_POR_NOTA, cartoes_da_linha, cartoes_da_nota
from estudos.models import Cartao

from .base import CasoBase


class LinhaComPergunta(CasoBase):
    def test_separa_pergunta_e_resposta(self):
        (cartao,) = cartoes_da_linha("Derivada de x² :: 2x")
        self.assertEqual(cartao["frente"], "Derivada de x²")
        self.assertEqual(cartao["verso"], "2x")

    def test_o_primeiro_separador_e_o_que_vale(self):
        (cartao,) = cartoes_da_linha("Notação :: f'(x) :: lê-se f linha")
        self.assertEqual(cartao["frente"], "Notação")
        self.assertEqual(cartao["verso"], "f'(x) :: lê-se f linha")

    def test_linha_sem_separador_nao_vira_cartao(self):
        self.assertEqual(cartoes_da_linha("Só um lembrete solto"), [])

    def test_lado_vazio_nao_vira_cartao_pela_metade(self):
        self.assertEqual(cartoes_da_linha("ver depois ::"), [])
        self.assertEqual(cartoes_da_linha(":: resposta sem pergunta"), [])

    def test_linha_em_branco_e_ignorada(self):
        self.assertEqual(cartoes_da_linha("   "), [])


class LinhaComLacuna(CasoBase):
    def test_uma_lacuna_vira_um_cartao(self):
        (cartao,) = cartoes_da_linha("A capital é {{c1::Brasília}}")
        self.assertEqual(cartao["frente"], "A capital é […]")
        self.assertEqual(cartao["verso"], "A capital é Brasília")

    def test_duas_lacunas_viram_dois_cartoes_da_mesma_frase(self):
        cartoes = cartoes_da_linha("{{c1::Tiradentes}} morreu em {{c2::1792}}")
        self.assertEqual(len(cartoes), 2)
        self.assertEqual(cartoes[0]["frente"], "[…] morreu em 1792")
        self.assertEqual(cartoes[1]["frente"], "Tiradentes morreu em […]")
        self.assertEqual(cartoes[0]["verso"], "Tiradentes morreu em 1792")

    def test_a_dica_aparece_no_lugar_do_vazio(self):
        (cartao,) = cartoes_da_linha("A capital é {{c1::Brasília::cidade}}")
        self.assertEqual(cartao["frente"], "A capital é [cidade]")
        self.assertEqual(cartao["verso"], "A capital é Brasília")

    def test_o_mesmo_numero_duas_vezes_esconde_as_duas(self):
        (cartao,) = cartoes_da_linha("{{c1::sen}}² + {{c1::cos}}² = 1")
        self.assertEqual(cartao["frente"], "[…]² + […]² = 1")

    def test_a_lacuna_ganha_do_separador_na_mesma_linha(self):
        cartoes = cartoes_da_linha("Limite :: {{c1::zero}}")
        self.assertEqual(len(cartoes), 1)
        self.assertEqual(cartoes[0]["origem"], "lacuna")


class NotaInteira(CasoBase):
    def test_le_varias_linhas(self):
        nota = "Resumo do assunto\nDerivada de x² :: 2x\nA capital é {{c1::Brasília}}"
        self.assertEqual(len(cartoes_da_nota(nota)), 2)

    def test_pergunta_repetida_entra_uma_vez_so(self):
        self.assertEqual(len(cartoes_da_nota("a :: b\na :: b")), 1)

    def test_nota_vazia_nao_gera_nada(self):
        self.assertEqual(cartoes_da_nota(""), [])
        self.assertEqual(cartoes_da_nota(None), [])

    def test_tem_teto_por_nota(self):
        nota = "\n".join(f"pergunta {i} :: resposta" for i in range(MAXIMO_POR_NOTA + 50))
        self.assertEqual(len(cartoes_da_nota(nota)), MAXIMO_POR_NOTA)


class PelaApi(CasoBase):
    def gerar(self, **extra):
        return self.post(f"/api/topicos/{self.topico.id}/cartoes-da-nota/", extra)

    def anotar(self, texto):
        self.topico.notas = texto
        self.topico.save(update_fields=["notas"])

    def test_cria_os_cartoes_da_nota(self):
        self.anotar("Derivada de x² :: 2x\nIntegral de 1/x :: ln|x|")
        dados = self.gerar().json()
        self.assertEqual(dados["criados"], 2)
        self.assertEqual(Cartao.objects.count(), 2)

    def test_conferir_nao_grava_nada(self):
        self.anotar("Derivada de x² :: 2x")
        dados = self.gerar(preview=1).json()
        self.assertEqual(dados["novos"], 1)
        self.assertEqual(Cartao.objects.count(), 0)

    def test_rodar_duas_vezes_nao_duplica(self):
        self.anotar("Derivada de x² :: 2x")
        self.gerar()
        dados = self.gerar().json()
        self.assertEqual(dados["criados"], 0)
        self.assertEqual(dados["existentes"], 1)
        self.assertEqual(Cartao.objects.count(), 1)

    def test_so_o_paragrafo_novo_vira_cartao(self):
        self.anotar("Derivada de x² :: 2x")
        self.gerar()
        self.anotar("Derivada de x² :: 2x\nIntegral de 1/x :: ln|x|")
        self.assertEqual(self.gerar().json()["criados"], 1)
        self.assertEqual(Cartao.objects.count(), 2)

    def test_os_cartoes_entram_depois_dos_que_ja_existiam(self):
        Cartao.objects.create(topico=self.topico, frente="À mão", verso="feito", ordem=3)
        self.anotar("Derivada de x² :: 2x")
        self.gerar()
        self.assertEqual(Cartao.objects.get(frente="Derivada de x²").ordem, 4)

    def test_nota_sem_sintaxe_nao_cria_nada(self):
        self.anotar("Um resumo comum, sem pergunta nenhuma.")
        self.assertEqual(self.gerar().json()["criados"], 0)

    def test_topico_inexistente_da_404(self):
        self.assertEqual(self.post("/api/topicos/9999/cartoes-da-nota/").status_code, 404)

    def test_get_nao_gera_nada(self):
        self.anotar("a :: b")
        resposta = self.client.get(f"/api/topicos/{self.topico.id}/cartoes-da-nota/")
        self.assertEqual(resposta.status_code, 405)
        self.assertEqual(Cartao.objects.count(), 0)

    def test_o_cartao_gerado_e_revisavel_como_qualquer_outro(self):
        self.anotar("A capital é {{c1::Brasília}}")
        self.gerar()
        self.topico.iniciar_revisoes()
        revisao = self.topico.revisoes.get()
        dados = self.client.get(f"/api/revisoes/{revisao.id}/cartoes/").json()
        self.assertEqual(dados["cartoes"][0]["frente"], "A capital é […]")
