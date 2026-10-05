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


# ---------------------------------------------------------------- perfil

COOKIE_DO_PERFIL = "perfil"
# Um ano: trocar de perfil é um clique, e ser perguntado toda semana numa
# máquina que é sua seria a burocracia que o app evitou até aqui.
DURACAO_DO_COOKIE = 365 * 24 * 3600

# Caminhos que funcionam sem perfil escolhido: a própria tela de escolha, a API
# que ela usa, e o que não é tela (estáticos, arquivos, service worker).
LIVRES = ("/perfis/", "/api/perfis/", "/static/", "/arquivos/", "/sw.js")


def perfil_atual(get_response):
    """Resolve de quem é o request e deixa isso valendo para as consultas.

    O app não tem login, então "quem está usando" é um cookie com o id do
    perfil -- a mesma pergunta que a TV da sala faz, sem senha. Sem cookie
    válido, toda tela desvia para a escolha: deixar entrar sem perfil mostraria
    uma tela vazia que parece banco apagado.

    O perfil escolhido entra no ContextVar de `escopo`, e é dali que os
    managers filtram. Ele é restaurado no fim do request, sempre -- um perfil
    que vazasse para o request seguinte seria o pior defeito possível aqui.
    """
    from urllib.parse import quote

    from django.http import JsonResponse
    from django.shortcuts import redirect
    from django.urls import reverse
    from django.utils import timezone

    from . import escopo
    from .models import Perfil

    def middleware(request):
        perfil = None
        bruto = request.COOKIES.get(COOKIE_DO_PERFIL)
        if bruto:
            perfil = Perfil.objects.filter(pk=bruto).first()

        request.perfil = perfil

        if perfil is None and not request.path.startswith(LIVRES):
            # Para o JS o desvio precisa ser um erro legível, não um HTML de
            # outra tela chegando onde se esperava JSON.
            if request.path.startswith("/api/"):
                return JsonResponse({"erro": "Escolha um perfil."}, status=409)
            destino = reverse("perfis")
            # Leva junto para onde se queria ir, para a escolha nao custar um
            # segundo clique ate a tela pedida.
            if request.path != "/":
                destino += f"?proximo={quote(request.get_full_path())}"
            return redirect(destino)

        token = escopo.definir(perfil)
        try:
            resposta = get_response(request)
        finally:
            escopo.restaurar(token)

        # Marca o uso uma vez por dia, só para ordenar a tela de escolha: um
        # UPDATE a cada request seria uma escrita por imagem carregada.
        if perfil is not None:
            agora = timezone.now()
            if perfil.ultimo_acesso is None or (agora - perfil.ultimo_acesso).days >= 1:
                Perfil.objects.filter(pk=perfil.pk).update(ultimo_acesso=agora)

        return resposta

    return middleware
