"""O que o runserver nao manda sozinho.

O `?v=<mtime>` de `estaticos.py` resolve metade do problema do cache: a URL do
CSS muda quando o CSS muda. Mas quem carrega essa URL e o HTML -- e o HTML nao
tinha versao nenhuma. Uma pagina guardada pelo navegador continua pedindo o
`?v=` antigo, e o CSS velho volta junto, agora com a aparencia de bug: o
grafico sem as regras da faixa vira uma fileira de rotulos colados.

Como o app e local e de uma pessoa so, a pagina nao precisa de cache nenhum:
renderizar de novo custa milissegundos e vale o alivio de nunca mais olhar para
uma tela velha sem saber que ela e velha.
"""


def html_sem_cache(get_response):
    def middleware(request):
        resposta = get_response(request)
        # So o HTML. Os estaticos tem o ?v= e podem (e devem) ficar em cache.
        if resposta.get("Content-Type", "").startswith("text/html"):
            resposta["Cache-Control"] = "no-store"
        return resposta

    return middleware
