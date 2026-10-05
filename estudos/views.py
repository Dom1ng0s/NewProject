import json
import unicodedata
from datetime import date, datetime, time, timedelta

from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from .models import (
    Avaliacao,
    Perfil,
    Configuracao,
    BlocoPlanejado,
    Cartao,
    Material,
    Materia,
    OcorrenciaPulada,
    Revisao,
    SessaoEstudo,
    Topico,
    hora_do_texto,
)
from . import backup, escopo
from .cartoes import cartoes_da_nota
from .fotos import FotoInvalida, conferir as conferir_foto
from .middleware import COOKIE_DO_PERFIL, DURACAO_DO_COOKIE
from .ical import eventos_de_ics
from .services import (
    NadaParaDesfazer,
    avaliacoes_proximas,
    bloco_de_agora,
    carga_futura,
    cartao_surpresa,
    dados_lembrete,
    investimento,
    marcos_novos,
    resumo_da_sessao,
    continuar_de_onde_parou,
    escada_dos_topicos,
    gravar_plano,
    plano_de_ataque,
    desfazer_ultima_resposta,
    registrar_resposta,
    ultima_resposta,
    dados_dashboard,
    dados_historico,
    progresso_do_dia,
    restantes_do_dia,
    dados_planner,
    parse_semana,
    segunda_da_semana,
)


def corpo(request):
    """Le o JSON do request; aceita tambem form-encoded."""
    if request.content_type and "json" in request.content_type:
        try:
            return json.loads(request.body or b"{}")
        except json.JSONDecodeError:
            return {}
    return request.POST.dict()


# ---------------------------------------------------------------- paginas


def pagina_dashboard(request):
    return render(request, "estudos/dashboard.html", {"pagina": "dashboard"})


def pagina_materias(request):
    return render(
        request,
        "estudos/materias.html",
        {"pagina": "materias", "status": Topico.STATUS},
    )


def pagina_sessao(request):
    config = Configuracao.atual()
    return render(
        request,
        "estudos/sessao.html",
        {
            "pagina": "sessao",
            "pomodoro_foco": config.pomodoro_foco_min,
            "pomodoro_pausa": config.pomodoro_pausa_min,
            "pomodoro_pausa_longa": config.pomodoro_pausa_longa_min,
            "pomodoro_ciclos": config.pomodoro_ciclos,
        },
    )


def pagina_planner(request):
    return render(
        request,
        "estudos/planner.html",
        {"pagina": "planner", "tipos": BlocoPlanejado.TIPOS},
    )


def pagina_quadro(request):
    return render(
        request,
        "estudos/quadro.html",
        {"pagina": "quadro", "status": Topico.STATUS},
    )


def pagina_revisar(request):
    return render(request, "estudos/revisar.html", {"pagina": "revisar"})


def fila_de_hoje_existe():
    return Revisao.objects.filter(
        feita=False, data_prevista__lte=timezone.localdate()
    ).exists()


def ir_para_agora(request):
    """/agora/: a URL que abre o app com o trabalho ja comecado.

    E o `start_url` do atalho da tela inicial e o destino do botao do
    dashboard. Quem decide e o servidor, de proposito: uma tela intermediaria
    para escolher o que fazer e exatamente o ponto em que se fecha o app em vez
    de estudar. Abrir e ja estar estudando nao e comodidade, e a diferenca
    entre abrir amanha e nao abrir.

    A ordem e a da urgencia real: o bloco do planner que cobre esta hora manda
    (a agenda ja decidiu), depois a fila de revisao (o SM-2 tem data e vence),
    e por fim o topico da ultima sessao. Sem nada disso, o dashboard.
    """
    atalho = continuar_de_onde_parou()
    bloco, _ = bloco_de_agora()

    def para_a_sessao():
        destino = reverse("sessao")
        return redirect(
            f"{destino}?topico_id={atalho['topico_id']}"
            f"&minutos={atalho['minutos']}&iniciar=1"
        )

    if bloco and atalho:
        return para_a_sessao()
    if fila_de_hoje_existe():
        return redirect(f"{reverse('revisar')}?iniciar=1")
    if atalho:
        return para_a_sessao()
    return redirect("dashboard")


# ---------------------------------------------------------------- dashboard / revisoes


@require_GET
def api_dashboard(request):
    """Tudo o que a tela de abertura mostra, numa chamada.

    O investimento e o lembrete entram aqui e nao em `dados_dashboard`: quem
    mais chama aquela funcao e a tela de revisao, que nao mostra nenhum dos
    dois e nao tem por que pagar as consultas deles.
    """
    return JsonResponse(
        {
            **dados_dashboard(),
            "investimento": investimento(),
            "lembrete": dados_lembrete(),
        }
    )


@require_POST
def api_marcos(request):
    """Os marcos ainda nao anunciados -- e os marca como anunciados.

    E POST porque escreve: ler a tela nao pode gastar o "ja falei disso", senao
    um F5 no caminho entre a conta e o aviso engole o parabens para sempre. O
    front pede isto depois de ja ter o dashboard na tela, e mostra o que vier.
    """
    return JsonResponse({"marcos": marcos_novos()})


@require_GET
def api_lembrete(request):
    """O lembrete do dia: o que ha em jogo e a que hora dizer.

    Serve a tela e tambem o service worker, que e quem consegue avisar com o
    app fechado onde o navegador deixa.
    """
    return JsonResponse(dados_lembrete())


@require_GET
def api_carga(request):
    """O que esta marcado para as proximas semanas, com as provas por cima."""
    return JsonResponse(carga_futura())


@require_GET
def api_revisoes_hoje(request):
    """A fila de hoje ja cortada no teto, mais o que ficou para depois."""
    dados = dados_dashboard()
    return JsonResponse(
        {
            "fila": dados["fila_do_dia"],
            "esperando": dados["fila_esperando"],
            "maximo_por_dia": dados["maximo_por_dia"],
            "hoje": len(dados["revisoes_hoje"]),
            "atrasadas": len(dados["revisoes_atrasadas"]),
            # Quanto da fila do dia ja fechou: e o que pode chegar a 100%.
            "progresso": dados["progresso"],
            "sequencia": dados["sequencia"],
            # O que o botao "Desfazer" devolveria; None esconde o botao.
            "ultima_resposta": ultima_resposta(),
        }
    )


@require_GET
def api_revisao_cartoes(request, pk):
    """Os cartoes do topico desta revisao, na ordem em que serao mostrados."""
    revisao = get_object_or_404(Revisao, pk=pk)
    cartoes = [c.json() for c in revisao.topico.cartoes.all()]
    return JsonResponse({"revisao": revisao.json(cartoes=len(cartoes)), "cartoes": cartoes})


# As quatro notas da tela, traduzidas para a escala 0-5 do SM-2.
QUALIDADES = {"errei": 0, "dificil": 3, "bom": 4, "facil": 5}


@require_POST
def api_revisao_responder(request, pk):
    """Fecha a revisao com uma nota e agenda a proxima pelo SM-2."""
    revisao = get_object_or_404(Revisao, pk=pk)
    dados = corpo(request)
    resposta = dados.get("resposta")
    if resposta not in QUALIDADES:
        return JsonResponse({"erro": "Resposta invalida."}, status=400)

    # Fechar a revisao mexe em quatro lugares de uma vez; a conta inteira mora
    # em services.registrar_resposta, que tambem grava o log.
    log, nova = registrar_resposta(revisao, QUALIDADES[resposta])
    topico = revisao.topico
    return JsonResponse(
        {
            "ok": True,
            "revisao": revisao.json(),
            "proxima": nova.json() if nova else None,
            "intervalo_dias": topico.intervalo_dias,
            "facilidade": topico.facilidade,
            "resposta_id": log.id,
            # O degrau que a nota moveu. Ver "1 dia -> 6 dias" e a unica
            # recompensa honesta que a tela tem para dar: nao e um ponto
            # inventado, e a propria escada do SM-2 andando.
            "intervalo_antes": log.intervalo_antes,
            "intervalo_depois": log.intervalo_depois,
            "topico": topico.nome,
            # Fechar a fila e o fim da tarefa; a tela precisa saber quando foi.
            "progresso": progresso_do_dia(restantes_do_dia()),
        }
    )


@require_POST
def api_revisao_desfazer(request):
    """Devolve o topico ao estado de antes da ultima nota dada.

    Errar o 1 em vez do 3 nao pode ser definitivo: a nota errada derruba a
    facilidade e o intervalo, e so o log sabe de onde o topico veio.
    """
    try:
        dados = desfazer_ultima_resposta()
    except NadaParaDesfazer as erro:
        return JsonResponse({"erro": str(erro)}, status=400)
    return JsonResponse({"ok": True, **dados})


# ---------------------------------------------------------------- cartoes


@require_GET
def api_cartoes(request):
    cartoes = Cartao.objects.select_related("topico")
    if request.GET.get("topico_id"):
        cartoes = cartoes.filter(topico_id=request.GET["topico_id"])
    return JsonResponse({"cartoes": [c.json() for c in cartoes]})


@require_GET
def api_cartao_surpresa(request):
    """Um cartao ao acaso de um topico dominado. Nao e revisao: nao da nota."""
    surpresa = cartao_surpresa()
    if not surpresa:
        return JsonResponse(
            {"erro": "Nenhum tópico dominado tem cartão ainda."}, status=404
        )
    return JsonResponse(surpresa)


def ler_cartao(dados, cartao):
    frente = (dados.get("frente") or "").strip()
    verso = (dados.get("verso") or "").strip()
    if not frente:
        raise ValueError("Escreva a pergunta.")
    if not verso:
        raise ValueError("Escreva a resposta.")
    cartao.frente = frente
    cartao.verso = verso
    if "ordem" in dados:
        try:
            cartao.ordem = max(int(dados["ordem"]), 0)
        except (TypeError, ValueError):
            raise ValueError("Ordem precisa ser um numero.")


@require_POST
def api_cartao_criar(request):
    dados = corpo(request)
    topico = get_object_or_404(Topico, pk=dados.get("topico_id"))
    cartao = Cartao(topico=topico)
    try:
        ler_cartao(dados, cartao)
    except ValueError as erro:
        return JsonResponse({"erro": str(erro)}, status=400)
    if "ordem" not in dados:
        ultimo = topico.cartoes.order_by("-ordem").first()
        cartao.ordem = (ultimo.ordem + 1) if ultimo else 0
    cartao.save()
    return JsonResponse({"ok": True, "cartao": cartao.json()})


@require_POST
def api_cartao_editar(request, pk):
    cartao = get_object_or_404(Cartao, pk=pk)
    try:
        ler_cartao(corpo(request), cartao)
    except ValueError as erro:
        return JsonResponse({"erro": str(erro)}, status=400)
    cartao.save()
    return JsonResponse({"ok": True, "cartao": cartao.json()})


@require_POST
def api_cartao_excluir(request, pk):
    get_object_or_404(Cartao, pk=pk).delete()
    return JsonResponse({"ok": True})


@require_POST
def api_cartoes_da_nota(request, pk):
    """Transforma a nota do topico em cartoes. Com `preview`, so mostra.

    O que ja existe com a mesma pergunta nao entra de novo: rodar duas vezes
    depois de acrescentar um paragrafo cria so o que o paragrafo trouxe.
    """
    topico = get_object_or_404(Topico, pk=pk)
    achados = cartoes_da_nota(topico.notas)

    existentes = set(topico.cartoes.values_list("frente", flat=True))
    novos = [c for c in achados if c["frente"] not in existentes]

    if corpo(request).get("preview"):
        return JsonResponse(
            {
                "ok": True,
                "achados": achados,
                "novos": len(novos),
                "existentes": len(achados) - len(novos),
            }
        )

    ultimo = topico.cartoes.order_by("-ordem").first()
    ordem = (ultimo.ordem + 1) if ultimo else 0
    criados = []
    for i, cartao in enumerate(novos):
        criados.append(
            Cartao.objects.create(
                topico=topico,
                frente=cartao["frente"],
                verso=cartao["verso"],
                ordem=ordem + i,
            )
        )
    return JsonResponse(
        {
            "ok": True,
            "criados": len(criados),
            "existentes": len(achados) - len(novos),
            "cartoes": [c.json() for c in criados],
        }
    )


# ---------------------------------------------------------------- materias


@require_GET
def api_materias(request):
    return JsonResponse({"materias": [m.json() for m in Materia.objects.all()]})


@require_POST
def api_materia_criar(request):
    dados = corpo(request)
    nome = (dados.get("nome") or "").strip()
    if not nome:
        return JsonResponse({"erro": "Informe o nome da materia."}, status=400)
    if Materia.objects.filter(nome__iexact=nome).exists():
        return JsonResponse({"erro": "Ja existe uma materia com esse nome."}, status=400)
    materia = Materia.objects.create(
        nome=nome,
        cor=dados.get("cor") or "#4f8cff",
        meta_horas_semanais=float(dados.get("meta_horas_semanais") or 0),
    )
    return JsonResponse({"ok": True, "materia": materia.json()})


@require_POST
def api_materia_editar(request, pk):
    materia = get_object_or_404(Materia, pk=pk)
    dados = corpo(request)
    if dados.get("nome"):
        materia.nome = dados["nome"].strip()
    if dados.get("cor"):
        materia.cor = dados["cor"]
    if "meta_horas_semanais" in dados:
        materia.meta_horas_semanais = float(dados["meta_horas_semanais"] or 0)
    materia.save()
    return JsonResponse({"ok": True, "materia": materia.json()})


@require_POST
def api_materia_excluir(request, pk):
    get_object_or_404(Materia, pk=pk).delete()
    return JsonResponse({"ok": True})


# ---------------------------------------------------------------- topicos


@require_GET
def api_arvore(request):
    """Materias com seus topicos em arvore de ate 3 niveis."""
    filhos = {}
    for topico in Topico.objects.all():
        filhos.setdefault(topico.pai_id, []).append(topico)

    # Os ultimos intervalos de cada topico, para a escadinha na linha do ramo.
    escada = escada_dos_topicos()

    def ramo(topico):
        dados = topico.json()
        dados["escada"] = escada.get(topico.id, [])
        dados["filhos"] = [ramo(f) for f in filhos.get(topico.id, [])]
        return dados

    saida = []
    for materia in Materia.objects.all():
        raizes = [t for t in filhos.get(None, []) if t.materia_id == materia.id]
        item = materia.json()
        item["topicos"] = [ramo(t) for t in raizes]
        saida.append(item)
    return JsonResponse({"materias": saida})


@require_GET
def api_topicos(request):
    """Lista plana com caminho legivel, usada nos seletores."""
    topicos = Topico.objects.select_related("materia", "pai", "pai__pai")
    if request.GET.get("materia_id"):
        topicos = topicos.filter(materia_id=request.GET["materia_id"])
    itens = []
    for topico in topicos:
        partes = [topico.nome]
        atual = topico.pai
        while atual:
            partes.insert(0, atual.nome)
            atual = atual.pai
        dados = topico.json()
        dados["materia"] = topico.materia.nome
        dados["cor"] = topico.materia.cor
        dados["caminho"] = " / ".join(partes)
        itens.append(dados)
    itens.sort(key=lambda d: (d["materia"], d["caminho"]))
    return JsonResponse({"topicos": itens})


@require_POST
def api_topico_criar(request):
    dados = corpo(request)
    nome = (dados.get("nome") or "").strip()
    if not nome:
        return JsonResponse({"erro": "Informe o nome do topico."}, status=400)
    pai = None
    if dados.get("pai_id"):
        pai = get_object_or_404(Topico, pk=dados["pai_id"])
        if pai.nivel >= 2:  # materia > assunto > subtopico
            return JsonResponse({"erro": "A arvore vai ate 3 niveis."}, status=400)
        materia = pai.materia
    else:
        materia = get_object_or_404(Materia, pk=dados.get("materia_id"))
    topico = Topico.objects.create(materia=materia, pai=pai, nome=nome)
    return JsonResponse({"ok": True, "topico": topico.json()})


@require_POST
def api_topico_editar(request, pk):
    topico = get_object_or_404(Topico, pk=pk)
    dados = corpo(request)
    campos = []
    if dados.get("nome"):
        topico.nome = dados["nome"].strip()
        campos.append("nome")
    if "notas" in dados:
        topico.notas = (dados.get("notas") or "").strip()
        campos.append("notas")
    if campos:
        topico.save(update_fields=campos)
    return JsonResponse({"ok": True, "topico": topico.json()})


@require_POST
def api_topico_status(request, pk):
    """Trocar status; revisado/dominado agendam as revisoes automaticas."""
    topico = get_object_or_404(Topico, pk=pk)
    status = corpo(request).get("status")
    if status not in dict(Topico.STATUS):
        return JsonResponse({"erro": "Status invalido."}, status=400)
    topico.status = status
    topico.save()
    criada = None
    if status in (Topico.REVISADO, Topico.DOMINADO):
        criada = topico.iniciar_revisoes()
    return JsonResponse(
        {"ok": True, "topico": topico.json(), "revisao_agendada": bool(criada)}
    )


@require_POST
def api_topico_excluir(request, pk):
    get_object_or_404(Topico, pk=pk).delete()
    return JsonResponse({"ok": True})


# ---------------------------------------------------------------- sessoes


@require_GET
def api_sessoes(request):
    sessoes = SessaoEstudo.objects.select_related("topico__materia")
    materia_id = request.GET.get("materia_id")
    if materia_id:
        sessoes = sessoes.filter(topico__materia_id=materia_id)
    for campo, filtro in (("de", "inicio__date__gte"), ("ate", "inicio__date__lte")):
        valor = request.GET.get(campo)
        if valor:
            try:
                sessoes = sessoes.filter(**{filtro: date.fromisoformat(valor)})
            except ValueError:
                pass
    sessoes = list(sessoes[:200])
    total = sum(s.duracao_min for s in sessoes)
    return JsonResponse({"sessoes": [s.json() for s in sessoes], "total_min": total})


@require_POST
def api_sessao_criar(request):
    dados = corpo(request)
    topico = get_object_or_404(Topico, pk=dados.get("topico_id"))
    duracao = int(float(dados.get("duracao_min") or 0))
    if duracao <= 0:
        return JsonResponse({"erro": "Duracao precisa ser maior que zero."}, status=400)
    inicio = timezone.now()
    if dados.get("inicio"):
        try:
            bruto = datetime.fromisoformat(str(dados["inicio"]).replace("Z", "+00:00"))
            inicio = bruto if timezone.is_aware(bruto) else timezone.make_aware(bruto)
        except ValueError:
            pass
    try:
        interrupcoes = max(int(dados.get("interrupcoes") or 0), 0)
    except (TypeError, ValueError):
        return JsonResponse({"erro": "Interrupcoes precisa ser um numero."}, status=400)

    sessao = SessaoEstudo.objects.create(
        topico=topico,
        inicio=inicio,
        duracao_min=duracao,
        nota=dados.get("nota", ""),
        interrupcoes=min(interrupcoes, 999),
    )
    # Estudar um topico tambem agenda as revisoes.
    if topico.status == Topico.NAO_INICIADO:
        topico.status = Topico.ESTUDANDO
        topico.save()
    criada = topico.iniciar_revisoes()
    return JsonResponse(
        {
            "ok": True,
            "sessao": sessao.json(),
            "revisao_agendada": bool(criada),
            # O que esta sessao acabou de mover. Sem isto ela termina em nada:
            # o cronometro zera e cinquenta minutos de esforco nao aparecem.
            "resumo": resumo_da_sessao(sessao),
        }
    )


@require_POST
def api_sessao_excluir(request, pk):
    get_object_or_404(SessaoEstudo, pk=pk).delete()
    return JsonResponse({"ok": True})


# ---------------------------------------------------------------- planner


@require_GET
def api_planner(request):
    return JsonResponse(dados_planner(parse_semana(request.GET.get("semana"))))


def preencher_bloco(bloco, dados, semana_atual=None):
    """Aplica o corpo da requisicao no bloco. Devolve a mensagem de erro, ou None.

    Serve para criar e para editar: as regras sao as mesmas nos dois casos.
    """
    tipo = dados.get("tipo") or BlocoPlanejado.ESTUDO
    if tipo not in dict(BlocoPlanejado.TIPOS):
        return "Tipo invalido."

    topico = None
    materia = None
    if dados.get("topico_id"):
        topico = get_object_or_404(Topico, pk=dados["topico_id"])
        materia = topico.materia
    elif dados.get("materia_id"):
        materia = get_object_or_404(Materia, pk=dados["materia_id"])

    titulo = (dados.get("titulo") or "").strip()
    if not materia and not titulo:
        return "Escolha uma materia ou escreva um titulo."

    bloco.tipo = tipo
    bloco.titulo = titulo
    bloco.descricao = (dados.get("descricao") or "").strip()
    bloco.materia = materia
    bloco.topico = topico
    # recorrente guarda semana nula: vale para todas as semanas
    if dados.get("recorrente"):
        bloco.semana = None
    else:
        bloco.semana = parse_semana(dados.get("semana")) or semana_atual

    try:
        bloco.dia_semana = int(dados.get("dia_semana") or 0)
        bloco.hora_inicio = dados["hora_inicio"]
        bloco.hora_fim = dados["hora_fim"]
        bloco.full_clean(exclude=["topico", "materia", "semana"])
    except KeyError:
        return "Informe inicio e fim."
    except Exception:
        return "Dados invalidos."

    if bloco.duracao_min <= 0:
        return "O fim precisa ser depois do inicio."
    return None


@require_POST
def api_bloco_criar(request):
    bloco = BlocoPlanejado()
    erro = preencher_bloco(bloco, corpo(request))
    if erro:
        return JsonResponse({"erro": erro}, status=400)
    bloco.save()
    return JsonResponse({"ok": True, "bloco": bloco.json()})


@require_POST
def api_bloco_editar(request, pk):
    bloco = get_object_or_404(BlocoPlanejado, pk=pk)
    era_recorrente = bloco.recorrente
    erro = preencher_bloco(bloco, corpo(request), semana_atual=segunda_da_semana())
    if erro:
        return JsonResponse({"erro": erro}, status=400)
    bloco.save()
    # deixou de ser recorrente: as ocorrencias puladas nao querem dizer nada
    if era_recorrente and not bloco.recorrente:
        OcorrenciaPulada.objects.filter(bloco=bloco).delete()
    return JsonResponse({"ok": True, "bloco": bloco.json()})


@require_POST
def api_bloco_excluir(request, pk):
    get_object_or_404(BlocoPlanejado, pk=pk).delete()
    return JsonResponse({"ok": True})


@require_POST
def api_bloco_pular(request, pk):
    """Liga/desliga uma ocorrencia de bloco recorrente numa semana."""
    bloco = get_object_or_404(BlocoPlanejado, pk=pk)
    if not bloco.recorrente:
        return JsonResponse({"erro": "So blocos recorrentes podem ser pulados."}, status=400)
    semana = parse_semana(corpo(request).get("semana"))
    pulada = OcorrenciaPulada.objects.filter(bloco=bloco, semana=semana).first()
    if pulada:
        pulada.delete()
        return JsonResponse({"ok": True, "pulado": False})
    OcorrenciaPulada.objects.create(bloco=bloco, semana=semana)
    return JsonResponse({"ok": True, "pulado": True})


LIMITE_ICS = 2 * 1024 * 1024


def _materia_do_titulo(titulo, materias):
    """Casa o evento com uma materia cujo nome apareca no titulo."""
    alvo = titulo.lower()
    for materia in materias:
        if materia.nome.lower() in alvo:
            return materia
    return None


@require_POST
def api_importar_ical(request):
    """Le um .ics e vira blocos do planner. Com preview=1, so mostra o que faria."""
    arquivo = request.FILES.get("arquivo")
    if not arquivo:
        return JsonResponse({"erro": "Escolha um arquivo .ics."}, status=400)
    if arquivo.size > LIMITE_ICS:
        return JsonResponse({"erro": "Arquivo maior que 2 MB."}, status=400)

    bruto = arquivo.read()
    for codificacao in ("utf-8-sig", "latin-1"):
        try:
            texto = bruto.decode(codificacao)
            break
        except UnicodeDecodeError:
            continue
    else:
        return JsonResponse({"erro": "Nao consegui ler o texto do arquivo."}, status=400)

    if "BEGIN:VCALENDAR" not in texto.upper():
        return JsonResponse({"erro": "Isso nao parece um arquivo iCalendar."}, status=400)

    tipo = request.POST.get("tipo") or BlocoPlanejado.AULA
    if tipo not in dict(BlocoPlanejado.TIPOS):
        return JsonResponse({"erro": "Tipo invalido."}, status=400)

    materia_fixa = None
    if request.POST.get("materia_id"):
        materia_fixa = get_object_or_404(Materia, pk=request.POST["materia_id"])
    materias = list(Materia.objects.all())
    preview = request.POST.get("preview") == "1"

    itens = []
    criados = 0
    for evento in eventos_de_ics(texto):
        if evento.get("ignorado"):
            itens.append({**evento, "situacao": "ignorado"})
            continue

        semana = None if evento["recorrente"] else segunda_da_semana(
            date.fromisoformat(evento["data"])
        )
        materia = materia_fixa or _materia_do_titulo(evento["titulo"], materias)

        ja_existe = BlocoPlanejado.objects.filter(
            titulo=evento["titulo"],
            semana=semana,
            dia_semana=evento["dia_semana"],
            hora_inicio=evento["hora_inicio"],
            hora_fim=evento["hora_fim"],
        ).exists()

        item = {
            **evento,
            "materia": materia.nome if materia else "",
            "situacao": "existe" if ja_existe else "novo",
        }
        itens.append(item)

        if ja_existe or preview:
            continue
        BlocoPlanejado.objects.create(
            tipo=tipo,
            titulo=evento["titulo"],
            materia=materia,
            semana=semana,
            dia_semana=evento["dia_semana"],
            hora_inicio=evento["hora_inicio"],
            hora_fim=evento["hora_fim"],
        )
        criados += 1

    resumo = {
        "novos": sum(1 for i in itens if i["situacao"] == "novo"),
        "existentes": sum(1 for i in itens if i["situacao"] == "existe"),
        "ignorados": sum(1 for i in itens if i["situacao"] == "ignorado"),
        "criados": criados,
        "preview": preview,
    }
    return JsonResponse({"ok": True, "resumo": resumo, "itens": itens})


# ---------------------------------------------------------------- configuracoes


# Faixa aceita de cada ajuste. Fora dela o app nao funciona direito -- um
# intervalo de 0 dia revisaria o mesmo topico para sempre no mesmo dia.
FAIXAS = {
    "primeiro_intervalo_dias": (1, 365),
    "segundo_intervalo_dias": (1, 365),
    "intervalo_maximo_dias": (1, 3650),
    "facilidade_minima": (1.1, 3.0),
    "maximo_revisoes_por_dia": (0, 500),
    "meta_horas_semanais": (0, 168),
    "dias_materia_parada": (1, 365),
    "dias_proximas_avaliacoes": (1, 365),
    "folgas_por_semana": (0, 7),
    "pomodoro_foco_min": (1, 180),
    "pomodoro_pausa_min": (1, 60),
    "pomodoro_pausa_longa_min": (1, 120),
    "pomodoro_ciclos": (1, 12),
}

DECIMAIS = {"facilidade_minima", "meta_horas_semanais"}


# ---------------------------------------------------------------- perfis


def pagina_perfis(request):
    """A tela de escolha: quem está estudando.

    Fica fora do `base.html` de propósito -- o menu lateral, a busca e o título
    com as pendentes só fazem sentido depois de escolher de quem é o app.
    """
    return render(
        request,
        "estudos/perfis.html",
        {"perfis": [p.json() for p in Perfil.objects.all()], "cores": Perfil.CORES},
    )


@require_GET
def api_perfis(request):
    return JsonResponse(
        {
            "perfis": [p.json() for p in Perfil.objects.all()],
            "atual": request.perfil.id if request.perfil else None,
            "cores": Perfil.CORES,
        }
    )


def ler_perfil(dados, perfil, arquivo=None):
    """Nome, cor e foto, validados. Levanta ValueError com o texto da tela."""
    nome = (dados.get("nome") or "").strip()
    if not nome:
        raise ValueError("Escreva um nome.")
    if len(nome) > 40:
        raise ValueError("O nome passa de 40 letras.")

    repetido = Perfil.objects.filter(nome__iexact=nome).exclude(pk=perfil.pk)
    if repetido.exists():
        raise ValueError(f'Já existe um perfil chamado "{nome}".')

    cor = (dados.get("cor") or "").strip()
    if cor and cor not in Perfil.CORES:
        raise ValueError("Cor fora da paleta.")

    perfil.nome = nome
    if cor:
        perfil.cor = cor

    if arquivo is not None:
        try:
            extensao = conferir_foto(arquivo)
        except FotoInvalida as erro:
            raise ValueError(str(erro))
        # O nome do arquivo vem de fora; o que vale e o formato que os bytes
        # disseram, nao a extensao que veio escrita.
        arquivo.name = f"{nome[:20]}.{extensao}"
        perfil.foto = arquivo

    return perfil


@require_POST
def api_perfil_criar(request):
    dados = request.POST if request.FILES else corpo(request)
    try:
        perfil = ler_perfil(dados, Perfil(), request.FILES.get("foto"))
    except ValueError as erro:
        return JsonResponse({"erro": str(erro)}, status=400)
    perfil.save()
    return JsonResponse({"ok": True, "perfil": perfil.json()})


@require_POST
def api_perfil_editar(request, pk):
    perfil = get_object_or_404(Perfil, pk=pk)
    dados = request.POST if request.FILES else corpo(request)
    try:
        ler_perfil(dados, perfil, request.FILES.get("foto"))
    except ValueError as erro:
        return JsonResponse({"erro": str(erro)}, status=400)

    if dados.get("remover_foto") in ("1", True, "true"):
        perfil.foto = ""
    perfil.save()
    return JsonResponse({"ok": True, "perfil": perfil.json()})


@require_POST
def api_perfil_excluir(request, pk):
    """Apaga o perfil e, junto, tudo o que era dele.

    O aviso na tela diz o tamanho do estrago antes: sem isso, "excluir perfil"
    parece apagar um nome e apaga um semestre.
    """
    perfil = get_object_or_404(Perfil, pk=pk)
    # O id tem de ser lido antes: `delete()` zera o `pk` da instancia, e a
    # comparacao depois nunca bateria -- o cookie ficaria apontando para um
    # perfil que nao existe mais.
    era_o_meu = request.perfil is not None and request.perfil.pk == perfil.pk
    perfil.delete()

    resposta = JsonResponse({"ok": True})
    if era_o_meu:
        resposta.delete_cookie(COOKIE_DO_PERFIL)
    return resposta


@require_POST
def api_perfil_entrar(request, pk):
    """Guarda a escolha no cookie. É o único "login" que o app tem."""
    perfil = get_object_or_404(Perfil, pk=pk)
    resposta = JsonResponse({"ok": True, "perfil": perfil.json()})
    resposta.set_cookie(
        COOKIE_DO_PERFIL,
        str(perfil.pk),
        max_age=DURACAO_DO_COOKIE,
        samesite="Lax",
    )
    return resposta


@require_POST
def api_perfil_sair(request):
    resposta = JsonResponse({"ok": True})
    resposta.delete_cookie(COOKIE_DO_PERFIL)
    return resposta


def resumo_do_perfil(perfil):
    """Quanto dado o perfil tem, para o aviso de exclusão dizer o tamanho."""
    with escopo.como(perfil):
        return {
            "materias": Materia.objects.count(),
            "topicos": Topico.objects.count(),
            "sessoes": SessaoEstudo.objects.count(),
            "revisoes": Revisao.objects.filter(feita=True).count(),
        }


@require_GET
def api_perfil_resumo(request, pk):
    perfil = get_object_or_404(Perfil, pk=pk)
    return JsonResponse(resumo_do_perfil(perfil))


# ---------------------------------------------------------------- service worker


def service_worker(request):
    """O `sw.js`, servido da raiz porque so dali ele controla o app inteiro.

    Um service worker so enxerga o que esta no escopo do caminho onde foi
    servido: em `/static/js/sw.js` ele cuidaria de `/static/`, que e o que menos
    precisa. Por isso ele passa por uma view, e nao pela pasta de estaticos.

    Sem cache ele proprio: um service worker velho e eterno, e um app de uma
    pessoa nao tem como depurar isso.
    """
    resposta = render(
        request, "estudos/sw.js", content_type="application/javascript; charset=utf-8"
    )
    resposta["Cache-Control"] = "no-store"
    resposta["Service-Worker-Allowed"] = "/"
    return resposta


def pagina_configuracoes(request):
    return render(request, "estudos/configuracoes.html", {"pagina": "configuracoes"})


@require_GET
def api_configuracoes(request):
    return JsonResponse({"configuracao": Configuracao.atual().json()})


@require_POST
def api_configuracoes_salvar(request):
    dados = corpo(request)

    if dados.get("restaurar"):
        # Apaga e grava de novo com os padroes, em vez de so apagar: ler os
        # ajustes nao cria linha nenhuma (`Configuracao.atual`), entao quem
        # quer a linha de volta precisa pedir. Aqui e o unico lugar que pede.
        Configuracao.objects.all().delete()
        padrao = Configuracao()
        padrao.save()
        return JsonResponse({"ok": True, "configuracao": padrao.json()})

    config = Configuracao.atual()
    for nome, (minimo, maximo) in FAIXAS.items():
        if nome not in dados:
            continue
        bruto = dados[nome]
        try:
            valor = float(bruto) if nome in DECIMAIS else int(float(bruto))
        except (TypeError, ValueError):
            return JsonResponse(
                {"erro": f"{rotulo_do_ajuste(nome)} precisa ser um número."}, status=400
            )
        if not minimo <= valor <= maximo:
            return JsonResponse(
                {
                    "erro": f"{rotulo_do_ajuste(nome)} tem de ficar entre {minimo} e {maximo}."
                },
                status=400,
            )
        setattr(config, nome, valor)

    # O lembrete nao e um numero com faixa: um e caixa de marcar, o outro e uma
    # hora que pode vir vazia querendo dizer "escolha por mim".
    if "lembrete_ativo" in dados:
        config.lembrete_ativo = str(dados["lembrete_ativo"]).lower() in (
            "1",
            "true",
            "on",
            "sim",
        )
    if "lembrete_hora" in dados:
        bruto = str(dados["lembrete_hora"] or "").strip()
        hora = hora_do_texto(bruto)
        if bruto and hora is None:
            return JsonResponse(
                {"erro": "A hora do lembrete precisa estar no formato 19:00."},
                status=400,
            )
        config.lembrete_hora = hora

    if config.segundo_intervalo_dias <= config.primeiro_intervalo_dias:
        return JsonResponse(
            {"erro": "O segundo intervalo tem de ser maior que o primeiro."}, status=400
        )
    if config.intervalo_maximo_dias < config.segundo_intervalo_dias:
        return JsonResponse(
            {"erro": "O teto do intervalo não pode ser menor que o segundo intervalo."},
            status=400,
        )

    config.save()
    return JsonResponse({"ok": True, "configuracao": config.json()})


def rotulo_do_ajuste(nome):
    return nome.replace("_", " ").capitalize()


# ---------------------------------------------------------------- materiais


@require_GET
def api_materiais(request):
    materiais = Material.objects.select_related("topico")
    if request.GET.get("topico_id"):
        materiais = materiais.filter(topico_id=request.GET["topico_id"])
    return JsonResponse({"materiais": [m.json() for m in materiais]})


@require_POST
def api_material_criar(request):
    """Aceita link (JSON) ou arquivo (multipart). Um dos dois, nunca os dois."""
    dados = request.POST if request.FILES else corpo(request)
    topico = get_object_or_404(Topico, pk=dados.get("topico_id"))

    titulo = (dados.get("titulo") or "").strip()
    url = (dados.get("url") or "").strip()
    arquivo = request.FILES.get("arquivo")

    if not arquivo and not url:
        return JsonResponse({"erro": "Informe um link ou escolha um arquivo."}, status=400)
    if arquivo and url:
        return JsonResponse({"erro": "Escolha um link ou um arquivo, não os dois."}, status=400)
    if arquivo and arquivo.size > settings.MATERIAL_MAXIMO_BYTES:
        limite = settings.MATERIAL_MAXIMO_BYTES // (1024 * 1024)
        return JsonResponse({"erro": f"Arquivo maior que {limite} MB."}, status=400)
    if url and not url.lower().startswith(("http://", "https://")):
        return JsonResponse(
            {"erro": "O link precisa começar com http:// ou https://."}, status=400
        )

    material = Material(
        topico=topico,
        titulo=titulo or (arquivo.name if arquivo else url)[:160],
        url=url,
        nota=(dados.get("nota") or "").strip()[:200],
    )
    if arquivo:
        material.arquivo = arquivo
    material.save()
    return JsonResponse({"ok": True, "material": material.json()})


@require_POST
def api_material_excluir(request, pk):
    material = get_object_or_404(Material, pk=pk)
    # Apaga tambem o arquivo do disco; o registro sozinho nao serve de nada.
    if material.arquivo:
        material.arquivo.delete(save=False)
    material.delete()
    return JsonResponse({"ok": True})


# ---------------------------------------------------------------- busca


LIMITE_POR_GRUPO = 8

# Teto por tabela antes do filtro em Python. O banco e de uma pessoa so: sao
# dezenas de linhas, e o teto existe para a busca nunca varrer o mundo.
TETO_DA_VARREDURA = 500


def achatar(texto):
    """Minuscula e sem acento: "Cálculo" e "calculo" passam a ser a mesma coisa.

    O icontains do SQLite nao ignora acento, e procurar "calculo" e nao achar
    "Cálculo" e exatamente o que mais irrita numa busca em portugues.
    """
    sem_acento = unicodedata.normalize("NFD", texto or "")
    return "".join(c for c in sem_acento if unicodedata.category(c) != "Mn").casefold()


def casa(termo, *textos):
    return any(termo in achatar(t) for t in textos)


def recorte(texto, termo, tamanho=90):
    """O pedaco do texto em volta do termo, para o resultado dizer onde achou."""
    posicao = achatar(texto).find(achatar(termo))
    if posicao < 0:
        return texto[:tamanho] + ("…" if len(texto) > tamanho else "")
    comeco = max(posicao - tamanho // 3, 0)
    fim = min(comeco + tamanho, len(texto))
    return ("…" if comeco else "") + texto[comeco:fim].strip() + ("…" if fim < len(texto) else "")


def grupo(nome, linhas, combina, montar):
    """Filtra em Python e monta o grupo; devolve None quando nao achou nada."""
    itens = []
    for linha in linhas[:TETO_DA_VARREDURA]:
        if combina(linha):
            itens.append(montar(linha))
            if len(itens) == LIMITE_POR_GRUPO:
                break
    return {"nome": nome, "itens": itens} if itens else None


@require_GET
def api_busca(request):
    """Procura o termo em tudo que tem texto, agrupado por onde foi achado."""
    bruto = (request.GET.get("q") or "").strip()
    if len(bruto) < 2:
        return JsonResponse({"termo": bruto, "grupos": [], "total": 0})
    termo = achatar(bruto)

    grupos = [
        grupo(
            "Matérias",
            Materia.objects.all(),
            lambda m: casa(termo, m.nome),
            lambda m: {"titulo": m.nome, "detalhe": "", "cor": m.cor, "url": "/materias/"},
        ),
        grupo(
            "Tópicos",
            Topico.objects.select_related("materia"),
            lambda t: casa(termo, t.nome, t.notas),
            lambda t: {
                "titulo": t.nome,
                "detalhe": recorte(t.notas, bruto) if casa(termo, t.notas) else t.materia.nome,
                "cor": t.materia.cor,
                "url": "/materias/",
            },
        ),
        grupo(
            "Cartões",
            Cartao.objects.select_related("topico__materia"),
            lambda c: casa(termo, c.frente, c.verso),
            lambda c: {
                "titulo": recorte(c.frente, bruto),
                "detalhe": f"{c.topico.materia.nome} · {c.topico.nome}",
                "cor": c.topico.materia.cor,
                "url": "/materias/",
            },
        ),
        grupo(
            "Material",
            Material.objects.select_related("topico__materia"),
            lambda m: casa(termo, m.titulo, m.nota),
            lambda m: {
                "titulo": m.titulo,
                "detalhe": m.topico.nome + (f" · {m.nota}" if m.nota else ""),
                "cor": m.topico.materia.cor,
                "url": m.endereco,
                "externo": True,
            },
        ),
        grupo(
            "Provas e prazos",
            Avaliacao.objects.select_related("materia"),
            lambda a: casa(termo, a.titulo, a.descricao),
            lambda a: {
                "titulo": a.titulo,
                "detalhe": f"{a.materia.nome} · {a.data:%d/%m/%Y}",
                "cor": a.materia.cor,
                "url": "/avaliacoes/",
            },
        ),
        grupo(
            "Notas de sessão",
            SessaoEstudo.objects.select_related("topico__materia").exclude(nota=""),
            lambda s: casa(termo, s.nota),
            lambda s: {
                "titulo": recorte(s.nota, bruto),
                "detalhe": f"{s.topico.nome} · {timezone.localtime(s.inicio):%d/%m/%Y}",
                "cor": s.topico.materia.cor,
                "url": "/sessao/",
            },
        ),
        grupo(
            "Planner",
            BlocoPlanejado.objects.select_related("materia"),
            lambda b: casa(termo, b.titulo, b.descricao),
            lambda b: {
                "titulo": b.rotulo,
                "detalhe": f"{b.hora_inicio:%H:%M}–{b.hora_fim:%H:%M}",
                "cor": b.materia.cor if b.materia else "#8b93a7",
                "url": "/planner/",
            },
        ),
    ]
    grupos = [g for g in grupos if g]
    return JsonResponse(
        {"termo": bruto, "grupos": grupos, "total": sum(len(g["itens"]) for g in grupos)}
    )


# ---------------------------------------------------------------- historico


def pagina_historico(request):
    return render(request, "estudos/historico.html", {"pagina": "historico"})


@require_GET
def api_historico(request):
    return JsonResponse(dados_historico())


# ---------------------------------------------------------------- avaliacoes


def pagina_avaliacoes(request):
    return render(
        request,
        "estudos/avaliacoes.html",
        {"pagina": "avaliacoes", "tipos": Avaliacao.TIPOS},
    )


@require_GET
def api_avaliacoes(request):
    """Por padrao so as em aberto; `todas=1` traz tambem as ja concluidas."""
    if request.GET.get("todas"):
        avaliacoes = (
            Avaliacao.objects.select_related("materia").prefetch_related("topicos")
        )
        return JsonResponse({"avaliacoes": [a.json() for a in avaliacoes]})
    return JsonResponse({"avaliacoes": avaliacoes_proximas(dias=365 * 5)})


def preencher_avaliacao(avaliacao, dados, criando=False):
    """Le os campos do formulario. Levanta ValueError com a mensagem da tela."""
    if criando or "materia_id" in dados:
        materia = Materia.objects.filter(pk=dados.get("materia_id")).first()
        if not materia:
            raise ValueError("Escolha a matéria.")
        avaliacao.materia = materia

    if criando or "titulo" in dados:
        titulo = (dados.get("titulo") or "").strip()
        if not titulo:
            raise ValueError("Dê um título à avaliação.")
        avaliacao.titulo = titulo[:120]

    if criando or "data" in dados:
        try:
            avaliacao.data = date.fromisoformat(str(dados.get("data") or "")[:10])
        except ValueError:
            raise ValueError("Informe a data (AAAA-MM-DD).")

    if "hora" in dados:
        bruto = (dados.get("hora") or "").strip()
        if not bruto:
            avaliacao.hora = None
        else:
            try:
                avaliacao.hora = time.fromisoformat(bruto)
            except ValueError:
                raise ValueError("Horário inválido.")

    if "tipo" in dados:
        if dados["tipo"] not in dict(Avaliacao.TIPOS):
            raise ValueError("Tipo inválido.")
        avaliacao.tipo = dados["tipo"]

    if "descricao" in dados:
        avaliacao.descricao = dados.get("descricao") or ""

    for campo in ("peso", "nota"):
        if campo not in dados:
            continue
        bruto = dados.get(campo)
        if bruto in (None, ""):
            setattr(avaliacao, campo, 0 if campo == "peso" else None)
            continue
        try:
            setattr(avaliacao, campo, float(bruto))
        except (TypeError, ValueError):
            raise ValueError(f"{campo.capitalize()} precisa ser um número.")

    if "concluida" in dados:
        avaliacao.concluida = bool(dados["concluida"])


def ligar_topicos(avaliacao, dados):
    """Troca o conteudo que cai na avaliacao, so com topicos da mesma materia."""
    if "topico_ids" not in dados:
        return
    ids = dados.get("topico_ids") or []
    if not isinstance(ids, list):
        raise ValueError("Conteúdo em formato inesperado.")
    topicos = list(Topico.objects.filter(pk__in=ids, materia=avaliacao.materia))
    if len(topicos) != len(set(ids)):
        raise ValueError("Algum tópico não é da matéria da avaliação.")
    avaliacao.topicos.set(topicos)


@require_POST
def api_avaliacao_criar(request):
    dados = corpo(request)
    avaliacao = Avaliacao()
    try:
        preencher_avaliacao(avaliacao, dados, criando=True)
        avaliacao.save()
        ligar_topicos(avaliacao, dados)
    except ValueError as erro:
        return JsonResponse({"erro": str(erro)}, status=400)
    return JsonResponse({"ok": True, "avaliacao": avaliacao.json()})


@require_POST
def api_avaliacao_editar(request, pk):
    avaliacao = get_object_or_404(Avaliacao, pk=pk)
    dados = corpo(request)
    try:
        preencher_avaliacao(avaliacao, dados)
        avaliacao.save()
        ligar_topicos(avaliacao, dados)
    except ValueError as erro:
        return JsonResponse({"erro": str(erro)}, status=400)
    return JsonResponse({"ok": True, "avaliacao": avaliacao.json()})


@require_POST
def api_avaliacao_plano(request, pk):
    """Monta (e, sem `preview`, grava) o plano de estudo ate a vespera da prova.

    E o unico lugar em que o conteudo que cai, a data, o historico de erros e os
    buracos da semana decidem juntos. Com `preview`, nada e gravado.
    """
    avaliacao = get_object_or_404(Avaliacao, pk=pk)
    try:
        plano = plano_de_ataque(avaliacao)
    except ValueError as erro:
        return JsonResponse({"erro": str(erro)}, status=400)

    if corpo(request).get("preview"):
        return JsonResponse({"ok": True, "plano": plano, "gravado": None})
    return JsonResponse(
        {"ok": True, "plano": plano, "gravado": gravar_plano(avaliacao, plano)}
    )


@require_POST
def api_avaliacao_excluir(request, pk):
    get_object_or_404(Avaliacao, pk=pk).delete()
    return JsonResponse({"ok": True})


# ---------------------------------------------------------------- dados (backup)


def pagina_dados(request):
    return render(request, "estudos/dados.html", {"pagina": "dados"})


@require_GET
def api_backup_exportar(request):
    resposta = JsonResponse(backup.exportar(), json_dumps_params={"ensure_ascii": False})
    # Faz o navegador baixar em vez de abrir o JSON numa aba.
    resposta["Content-Disposition"] = f'attachment; filename="{backup.nome_do_arquivo()}"'
    return resposta


@require_POST
def api_backup_importar(request):
    dados = corpo(request)
    arquivo = dados.get("backup")
    if isinstance(arquivo, str):
        if len(arquivo.encode("utf-8")) > backup.LIMITE_BYTES:
            return JsonResponse({"erro": "Arquivo grande demais para ser um backup."}, status=400)
        try:
            arquivo = json.loads(arquivo)
        except json.JSONDecodeError:
            return JsonResponse({"erro": "O arquivo não é um JSON válido."}, status=400)
    if not isinstance(arquivo, dict):
        return JsonResponse({"erro": "Nenhum backup foi enviado."}, status=400)

    substituir = bool(dados.get("substituir"))
    try:
        if dados.get("preview"):
            backup.conferir(arquivo)
            return JsonResponse({"ok": True, "resumo": backup.resumir(arquivo)})
        resumo = backup.importar(arquivo, substituir=substituir)
    except ValueError as erro:
        return JsonResponse({"erro": str(erro)}, status=400)
    return JsonResponse({"ok": True, "resumo": resumo})
