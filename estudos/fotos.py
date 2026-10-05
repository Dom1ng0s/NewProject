"""A foto do perfil, conferida pelos bytes e não pelo nome do arquivo.

Sem Pillow não dá para abrir a imagem e perguntar se ela é uma imagem -- e
confiar na extensão nunca foi conferir nada, com ou sem biblioteca. O que dá
para fazer sem dependência nenhuma é o que os arquivos de imagem combinaram
entre si: os primeiros bytes dizem o formato.

É para o app não guardar um .exe renomeado e servi-lo de volta depois, não para
blindar um servidor local -- quem envia a foto é quem usa o app.
"""

# Primeiros bytes de cada formato que o navegador mostra sem plugin nenhum.
ASSINATURAS = [
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpg"),
    (b"GIF87a", "gif"),
    (b"GIF89a", "gif"),
]

# WebP e RIFF: "RIFF" + 4 bytes de tamanho + "WEBP".
def _e_webp(cabecalho):
    return cabecalho[:4] == b"RIFF" and cabecalho[8:12] == b"WEBP"


# Teto da foto. Um avatar de 150px não precisa de mais que isso, e o limite
# existe para um engano (mandar o PDF da apostila) não virar um upload de 40MB.
MAXIMO_BYTES = 5 * 1024 * 1024


class FotoInvalida(ValueError):
    """A foto não é uma imagem, ou é grande demais."""


def formato(arquivo):
    """A extensão da imagem, ou None se os bytes não forem de imagem."""
    posicao = arquivo.tell()
    arquivo.seek(0)
    cabecalho = arquivo.read(12)
    arquivo.seek(posicao)

    for assinatura, nome in ASSINATURAS:
        if cabecalho.startswith(assinatura):
            return nome
    return "webp" if _e_webp(cabecalho) else None


def conferir(arquivo):
    """Devolve a extensão da foto; levanta `FotoInvalida` se não servir."""
    if arquivo.size > MAXIMO_BYTES:
        megas = MAXIMO_BYTES // (1024 * 1024)
        raise FotoInvalida(f"A foto passa de {megas}MB.")

    tipo = formato(arquivo)
    if not tipo:
        raise FotoInvalida("Envie uma imagem PNG, JPG, GIF ou WebP.")
    return tipo
