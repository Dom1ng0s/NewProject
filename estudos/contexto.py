"""O que todo template precisa saber, sem cada view ter de passar.

Duas coisas: de quem e a tela, e quantas revisoes esperam. O numero vai para o `<title>`,
e e o lembrete mais barato que existe -- a aba fica escrita "(7) Estudos" no
meio das outras, sem notificacao, sem permissao e sem service worker. Um app
que nao chama nao e aberto, e o titulo chama sem incomodar.

Vem do servidor em vez de um fetch por tela: e uma contagem, e esperar o JS
para mostra-la faria o numero piscar na troca de cada pagina.
"""

from django.utils import timezone

from .models import Revisao


def pendentes(request):
    # A contagem ja sai filtrada pelo perfil: o manager de `Revisao` so enxerga
    # o dono atual, entao o numero no titulo e o da pessoa que esta usando.
    #
    # A API tem os erros dela; o titulo nao pode derrubar uma pagina por isso.
    try:
        total = Revisao.objects.filter(
            feita=False, data_prevista__lte=timezone.localdate()
        ).count()
    except Exception:
        total = 0

    perfil = getattr(request, "perfil", None)
    return {
        "revisoes_pendentes": total,
        "perfil_atual": perfil,
    }
