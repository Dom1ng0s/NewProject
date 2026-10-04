"""Cartoes escritos dentro da nota do topico.

Cadastrar cartao era uma tela a parte: abrir o dialogo, escrever a pergunta,
escrever a resposta, salvar. Resumir o assunto, por outro lado, ja e o que se
faz naturalmente -- e um resumo tem perguntas dentro dele.

Aqui o resumo vira cartao sem sair do texto, em duas sintaxes:

    pergunta :: resposta           -> um cartao, direto
    A capital é {{c1::Brasília}}   -> um cartao por lacuna (cloze)

Uma linha pode ter varias lacunas; `{{c1::...}}` e `{{c2::...}}` viram dois
cartoes da mesma frase, cada um escondendo a sua. A lacuna aceita uma dica
depois de outro `::`, que aparece no lugar do vazio.
"""

import re

# {{c1::resposta}} ou {{c1::resposta::dica}}
LACUNA = re.compile(r"\{\{c(\d+)::(.+?)(?:::(.+?))?\}\}", re.S)

SEPARADOR = "::"

# Teto por nota. Uma nota longa com lacunas em todo paragrafo poderia gerar
# centenas de cartoes de uma vez; o teto existe para o engano ser reversivel.
MAXIMO_POR_NOTA = 100

VAZIO = "[…]"


def _sem_marcas(texto):
    """A linha como ela se le: cada lacuna substituida pela propria resposta."""
    return LACUNA.sub(lambda m: m.group(2).strip(), texto).strip()


def _com_lacuna(texto, numero):
    """A linha com a lacuna `numero` escondida; as outras aparecem resolvidas."""

    def troca(achado):
        if int(achado.group(1)) != numero:
            return achado.group(2).strip()
        dica = (achado.group(3) or "").strip()
        return f"[{dica}]" if dica else VAZIO

    return LACUNA.sub(troca, texto).strip()


def cartoes_da_linha(linha):
    """Os cartoes que uma linha da nota gera. Lista vazia quando nao gera nenhum."""
    linha = linha.strip()
    if not linha:
        return []

    numeros = sorted({int(m.group(1)) for m in LACUNA.finditer(linha)})
    if numeros:
        resposta = _sem_marcas(linha)
        return [
            {"frente": _com_lacuna(linha, n), "verso": resposta, "origem": "lacuna"}
            for n in numeros
        ]

    if SEPARADOR in linha:
        frente, _, verso = linha.partition(SEPARADOR)
        frente, verso = frente.strip(), verso.strip()
        # Linha com "::" e um dos lados vazio nao e um cartao pela metade: nao e
        # um cartao. Escrever "ver depois ::" nao pode criar pergunta nenhuma.
        if frente and verso:
            return [{"frente": frente, "verso": verso, "origem": "pergunta"}]

    return []


def cartoes_da_nota(texto):
    """Os cartoes de uma nota inteira, sem repetir pergunta."""
    achados = []
    vistos = set()
    for linha in (texto or "").splitlines():
        for cartao in cartoes_da_linha(linha):
            if cartao["frente"] in vistos:
                continue
            vistos.add(cartao["frente"])
            achados.append(cartao)
            if len(achados) >= MAXIMO_POR_NOTA:
                return achados
    return achados
