"""Um semestre de Ciencia da Computacao, inventado com cuidado.

Dado de exemplo so serve se ele parecer uso de verdade: um banco com tres
sessoes perfeitas nao mostra fila cheia, nem materia parada, nem topico que
voce acha que sabe e nao sabe -- e sao essas telas que precisam ser olhadas
antes de confiar nelas.

Entao o que este comando monta e um semestre plausivel: aulas de quarta-feira,
estagio a tarde, um feriado prolongado sem estudar nenhum, provas que ja
passaram com nota, uma P2 chegando, topicos que subiram a escada do SM-2 e
topicos que caem dela sempre nos mesmos assuntos.

Duas honestidades sobre o que e fabricado de proposito:

- os topicos frageis recebem sessoes mais picadas que os solidos, para o painel
  de interrupcoes ter o que comparar. A correlacao e inventada; ela existe aqui
  para a tela poder ser avaliada, nao porque o dado a provou.
- a semente e fixa, entao rodar duas vezes da o mesmo semestre.
"""

import random
from datetime import datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from estudos.cartoes import cartoes_da_nota
from estudos.models import (
    Avaliacao,
    BlocoPlanejado,
    Cartao,
    Configuracao,
    Material,
    Materia,
    OcorrenciaPulada,
    RespostaRevisao,
    Revisao,
    SessaoEstudo,
    Topico,
    passo_do_sm2,
)
from estudos.services import segunda_da_semana

DIAS_DE_HISTORICO = 112  # 16 semanas: um semestre

# ------------------------------------------------------------------ materias

# (cor, meta semanal, {assunto: [subtopicos]})
GRADE = {
    "Algoritmos e Estruturas de Dados": (
        "#1f8a5b",
        6,
        {
            "Complexidade": ["Notação assintótica", "Análise amortizada"],
            "Estruturas lineares": ["Listas encadeadas", "Pilhas e filas"],
            "Árvores": ["Árvore binária de busca", "AVL", "Heap"],
            "Grafos": ["Busca em largura e profundidade", "Dijkstra", "Árvore geradora mínima"],
            "Ordenação": ["Quicksort", "Mergesort", "Ordenação linear"],
        },
    ),
    "Sistemas Operacionais": (
        "#e0533d",
        5,
        {
            "Processos e threads": ["Escalonamento", "Troca de contexto"],
            "Concorrência": ["Exclusão mútua", "Semáforos", "Deadlock"],
            "Memória": ["Paginação", "Memória virtual", "Substituição de páginas"],
            "Sistemas de arquivos": ["Inodes", "Journaling"],
        },
    ),
    "Banco de Dados": (
        "#2f6fd0",
        4,
        {
            "Modelagem": ["Entidade-relacionamento", "Normalização"],
            "SQL": ["Junções", "Agregação e GROUP BY", "Subconsultas"],
            "Internals": ["Índices B-tree", "Plano de execução", "Transações e ACID"],
        },
    ),
    "Redes de Computadores": (
        "#7b5cd6",
        3,
        {
            "Camadas": ["Modelo TCP/IP", "Encapsulamento"],
            "Transporte": ["TCP", "UDP", "Controle de congestionamento"],
            "Aplicação": ["HTTP", "DNS"],
        },
    ),
    "Matemática Discreta": (
        "#0f8f9e",
        4,
        {
            "Lógica": ["Tabela-verdade", "Quantificadores"],
            "Prova": ["Indução", "Contradição"],
            "Contagem": ["Permutação e combinação", "Princípio da casa dos pombos"],
            "Relações": ["Relação de equivalência", "Ordem parcial"],
        },
    ),
    "Engenharia de Software": (
        "#c9a227",
        3,
        {
            "Requisitos": ["Histórias de usuário"],
            "Projeto": ["SOLID", "Padrões de projeto"],
            "Testes": ["Pirâmide de testes", "Testes de unidade"],
        },
    ),
}

# Tópicos que o semestre não alcançou: ficam "não iniciados", como na vida.
AINDA_NAO_VISTOS = {
    "Árvore geradora mínima",
    "Substituição de páginas",
    "Journaling",
    "Subconsultas",
    "DNS",
    "Ordem parcial",
    "Padrões de projeto",
}

# Os que teimam em cair: alimentam o painel de tópicos frágeis.
TEIMOSOS = {
    "Deadlock",
    "Dijkstra",
    "Normalização",
    "Controle de congestionamento",
    "Indução",
    "Análise amortizada",
}

# ------------------------------------------------------------------ conteúdo

# Notas escritas na sintaxe que vira cartão: é assim que o app espera ser usado.
NOTAS = {
    "Notação assintótica": (
        "O(n) é teto, Ω(n) é piso, Θ(n) é os dois.\n"
        "O que O(f) limita :: o pior caso, a menos de constante\n"
        "Busca binária é {{c1::O(log n)}} porque o espaço cai pela {{c2::metade}} a cada passo\n"
        "Constante grande some na notação, mas não some no relógio."
    ),
    "Semáforos": (
        "Semáforo é contador + fila de espera.\n"
        "wait/P faz :: decrementa e bloqueia se ficar negativo\n"
        "signal/V faz :: incrementa e acorda alguém da fila\n"
        "Mutex é um semáforo {{c1::binário}}, e quem trava deve ser quem destrava."
    ),
    "Deadlock": (
        "As quatro condições de Coffman precisam valer ao mesmo tempo.\n"
        "Exclusão mútua, posse e espera, não preempção, {{c1::espera circular}}\n"
        "Quebrar a espera circular :: ordenar os recursos e sempre pedir na ordem\n"
        "Prevenir é diferente de evitar: evitar é o banqueiro, que precisa saber o máximo de cada um."
    ),
    "Índices B-tree": (
        "B-tree mantém tudo na mesma altura; a altura é o número de acessos a disco.\n"
        "Por que B-tree e não binária :: nó do tamanho do bloco, menos leituras de disco\n"
        "Índice ajuda em {{c1::igualdade e faixa}}, mas não em função sobre a coluna\n"
        "Índice não é de graça: todo INSERT paga."
    ),
    "TCP": (
        "Confiável, orientado a conexão, com controle de fluxo e de congestionamento.\n"
        "Three-way handshake :: SYN, SYN-ACK, ACK\n"
        "Janela deslizante serve para {{c1::controle de fluxo}}, não para congestionamento\n"
        "Fechar leva quatro passos porque cada lado fecha o seu sentido."
    ),
    "Indução": (
        "Base, hipótese, passo. O passo usa a hipótese — se não usou, não é indução.\n"
        "Indução forte supõe :: que vale para todo k menor ou igual a n\n"
        "O erro clássico é {{c1::assumir o que se quer provar}} no passo."
    ),
    "Paginação": (
        "Endereço virtual = número da página + deslocamento.\n"
        "TLB é :: a cache da tabela de páginas\n"
        "Página maior significa menos entradas na tabela e mais {{c1::fragmentação interna}}."
    ),
    "Junções": (
        "INNER corta o que não casa; LEFT guarda a tabela da esquerda inteira.\n"
        "LEFT JOIN com filtro no WHERE da tabela direita :: vira INNER sem querer\n"
        "Chave do join sem índice é {{c1::varredura completa}} nas duas tabelas."
    ),
}

# Cartões escritos à mão, para a árvore não ter só cartão gerado de nota.
CARTOES = {
    "Quicksort": [
        ("Pior caso do quicksort e quando acontece", "O(n²), com pivô sempre no extremo"),
        ("Por que quicksort ganha do mergesort na prática", "Ordena no lugar e tem boa localidade de cache"),
    ],
    "Dijkstra": [
        ("Por que Dijkstra não aceita peso negativo", "Ele fecha o nó ao visitá-lo; um peso negativo depois invalidaria o fechamento"),
        ("Complexidade com heap binário", "O((V + E) log V)"),
    ],
    "AVL": [
        ("Quando a AVL rebalanceia", "Quando o fator de balanceamento de um nó vira 2 ou -2"),
        ("Altura da AVL com n nós", "O(log n), garantido pelo balanceamento"),
    ],
    "Escalonamento": [
        ("Diferença entre preemptivo e cooperativo", "No preemptivo o SO tira a CPU do processo; no cooperativo o processo devolve"),
        ("O que o round-robin resolve", "Starvation: todo processo recebe fatia, ao custo de mais trocas de contexto"),
    ],
    "Transações e ACID": [
        ("O I de ACID", "Isolamento: transações concorrentes não enxergam o meio do caminho uma da outra"),
        ("O que o nível READ COMMITTED não evita", "Leitura não repetível e phantom reads"),
    ],
    "Exclusão mútua": [
        ("Condição de corrida, em uma frase", "O resultado depende da ordem em que as threads chegam"),
    ],
    "Normalização": [
        ("3FN em uma frase", "Nenhum atributo não-chave depende de outro atributo não-chave"),
    ],
}

MATERIAIS = {
    "Escalonamento": ("OSTEP — capítulo de escalonamento", "https://pages.cs.wisc.edu/~remzi/OSTEP/", "cap. 7–9"),
    "Memória virtual": ("OSTEP — virtualização de memória", "https://pages.cs.wisc.edu/~remzi/OSTEP/", "cap. 13–22"),
    "Índices B-tree": ("Documentação do PostgreSQL — índices", "https://www.postgresql.org/docs/current/indexes.html", "cap. 11"),
    "Junções": ("Documentação do PostgreSQL — queries", "https://www.postgresql.org/docs/current/queries-table-expressions.html", ""),
    "Dijkstra": ("CLRS — caminhos mínimos", "", "cap. 24"),
    "TCP": ("RFC 9293 — TCP", "https://www.rfc-editor.org/rfc/rfc9293.html", "seção 3.1"),
    "SOLID": ("Anotações da aula de ES", "", "aula 6"),
}

NOTAS_DE_SESSAO = [
    "Refiz os exercícios da lista; travei no último.",
    "Li a teoria e fiz o resumo. Falta exercitar.",
    "Exercícios da prova antiga — errei dois por desatenção.",
    "Implementei do zero para entender de verdade.",
    "Revisão rápida antes da aula.",
    "Assisti a aula gravada e tomei nota.",
    "",
    "",
    "Monitoria: tirei a dúvida do caso recursivo.",
    "Estudei com o pessoal do grupo; expliquei em voz alta e fechou.",
]


class Command(BaseCommand):
    help = "Popula o banco com um semestre de Ciência da Computação, para testar as telas."

    def add_arguments(self, parser):
        parser.add_argument("--limpar", action="store_true", help="Apaga os dados antes")

    def handle(self, *args, **opcoes):
        if opcoes["limpar"]:
            # Matéria em cascata leva tópico, sessão, revisão, cartão, log e
            # avaliação; bloco sem matéria e ocorrência pulada vão na mão.
            OcorrenciaPulada.objects.all().delete()
            BlocoPlanejado.objects.all().delete()
            Materia.objects.all().delete()

        self.aleatorio = random.Random(20)  # semente fixa: semestre reproduzível
        self.hoje = timezone.localdate()
        self.config = Configuracao.atual()

        folhas = self.montar_arvore()
        self.escrever_conteudo(folhas)
        self.montar_grade_fixa()
        dias_estudados = self.simular_sessoes(folhas)
        self.simular_revisoes(folhas)
        self.marcar_avaliacoes(folhas)
        self.blocos_da_semana()

        self.resumir(dias_estudados)

    # -------------------------------------------------------------- estrutura

    def montar_arvore(self):
        """Matérias > assuntos > subtópicos. Devolve as folhas, que são o que se estuda."""
        folhas = []
        for nome, (cor, meta, assuntos) in GRADE.items():
            materia, _ = Materia.objects.get_or_create(
                nome=nome, defaults={"cor": cor, "meta_horas_semanais": meta}
            )
            for assunto, subtopicos in assuntos.items():
                pai, _ = Topico.objects.get_or_create(
                    materia=materia, pai=None, nome=assunto
                )
                for sub in subtopicos:
                    filho, _ = Topico.objects.get_or_create(
                        materia=materia, pai=pai, nome=sub
                    )
                    folhas.append(filho)
        return folhas

    def escrever_conteudo(self, folhas):
        """Notas, cartões e material — o que faz o tópico ser mais que um nome."""
        por_nome = {t.nome: t for t in folhas}

        for nome, texto in NOTAS.items():
            topico = por_nome.get(nome)
            if not topico:
                continue
            topico.notas = texto
            topico.save(update_fields=["notas"])
            # A nota vira cartão pelo mesmo caminho da tela, não por atalho.
            ordem = 0
            for cartao in cartoes_da_nota(texto):
                Cartao.objects.get_or_create(
                    topico=topico,
                    frente=cartao["frente"],
                    defaults={"verso": cartao["verso"], "ordem": ordem},
                )
                ordem += 1

        for nome, cartoes in CARTOES.items():
            topico = por_nome.get(nome)
            if not topico:
                continue
            inicio = topico.cartoes.count()
            for i, (frente, verso) in enumerate(cartoes):
                Cartao.objects.get_or_create(
                    topico=topico, frente=frente, defaults={"verso": verso, "ordem": inicio + i}
                )

        for nome, (titulo, url, pagina) in MATERIAIS.items():
            topico = por_nome.get(nome)
            if not topico or not url:
                continue
            Material.objects.get_or_create(
                topico=topico, url=url, defaults={"titulo": titulo, "nota": pagina}
            )

    def montar_grade_fixa(self):
        """A grade que não muda: aulas, laboratório, estágio, academia."""
        fixos = [
            ("aula", "AED — teoria", "Algoritmos e Estruturas de Dados", 0, "08:00", "10:00"),
            ("aula", "Matemática Discreta", "Matemática Discreta", 0, "10:00", "12:00"),
            ("aula", "Sistemas Operacionais", "Sistemas Operacionais", 1, "08:00", "10:00"),
            ("aula", "AED — laboratório", "Algoritmos e Estruturas de Dados", 2, "08:00", "10:00"),
            ("aula", "Banco de Dados", "Banco de Dados", 2, "10:00", "12:00"),
            ("aula", "Redes de Computadores", "Redes de Computadores", 3, "08:00", "10:00"),
            ("aula", "Engenharia de Software", "Engenharia de Software", 4, "08:00", "10:00"),
            ("outro", "Estágio", None, 0, "13:00", "18:00"),
            ("outro", "Estágio", None, 1, "13:00", "18:00"),
            ("outro", "Estágio", None, 2, "13:00", "18:00"),
            ("outro", "Estágio", None, 3, "13:00", "18:00"),
            ("outro", "Estágio", None, 4, "13:00", "18:00"),
            ("outro", "Academia", None, 1, "19:00", "20:00"),
            ("outro", "Academia", None, 3, "19:00", "20:00"),
        ]
        for tipo, titulo, materia, dia, inicio, fim in fixos:
            BlocoPlanejado.objects.get_or_create(
                tipo=tipo,
                titulo=titulo,
                materia=Materia.objects.filter(nome=materia).first(),
                semana=None,
                dia_semana=dia,
                hora_inicio=time.fromisoformat(inicio),
                hora_fim=time.fromisoformat(fim),
            )

    # --------------------------------------------------------------- sessões

    def quanto_estudar(self, dia, vespera_de_prova):
        """Quantas sessões aquele dia teve. É aqui que o semestre ganha forma."""
        atras = (self.hoje - dia).days

        # Uma semana de sumiço: viagem, virose, a vida. O mapa precisa ter buraco.
        if 38 <= atras <= 45:
            return 0
        # Véspera de prova: estuda-se demais, e é isso que o app deveria ter evitado.
        if vespera_de_prova:
            return self.aleatorio.randint(2, 4)
        # Fim de semana rende menos, mas não zero.
        if dia.weekday() >= 5:
            return self.aleatorio.choice([0, 0, 1, 1, 2])
        return self.aleatorio.choice([0, 1, 1, 1, 2, 2])

    def simular_sessoes(self, folhas):
        """Sessões ao longo do semestre, com o perfil de cada dia e de cada tópico."""
        estudaveis = [t for t in folhas if t.nome not in AINDA_NAO_VISTOS]
        # Redes some das últimas semanas: é a matéria parada do dashboard.
        recentes = [t for t in estudaveis if t.materia.nome != "Redes de Computadores"]

        vesperas = {self.hoje - timedelta(days=d) for d in (63, 64, 30, 31, 32)}
        dias_estudados = set()

        for atras in range(DIAS_DE_HISTORICO, -1, -1):
            dia = self.hoje - timedelta(days=atras)
            quantas = self.quanto_estudar(dia, dia in vesperas)

            # A sequência atual: os últimos cinco dias não ficam vazios.
            if atras <= 4 and not quantas:
                quantas = 1

            escolha = estudaveis if atras > 21 else recentes
            for _ in range(quantas):
                topico = self.aleatorio.choice(escolha)
                hora = self.aleatorio.choice([7, 12, 19, 20, 21, 22])
                duracao = self.aleatorio.choice([25, 25, 50, 50, 50, 75, 90, 110])

                # Tópico teimoso é estudado mais picado. A correlação é
                # fabricada: ela existe para o painel ter o que comparar.
                if topico.nome in TEIMOSOS:
                    interrupcoes = self.aleatorio.randint(2, 7)
                else:
                    interrupcoes = self.aleatorio.choice([0, 0, 0, 1, 1, 2, 3])
                # Noite tarde interrompe mais que manhã.
                if hora >= 21:
                    interrupcoes += self.aleatorio.randint(0, 2)

                SessaoEstudo.objects.create(
                    topico=topico,
                    inicio=timezone.make_aware(
                        datetime.combine(dia, time(hora, self.aleatorio.choice([0, 15, 30])))
                    ),
                    duracao_min=duracao,
                    nota=self.aleatorio.choice(NOTAS_DE_SESSAO),
                    interrupcoes=interrupcoes,
                )
                dias_estudados.add(dia)

        return dias_estudados

    # -------------------------------------------------------------- revisões

    def proxima_nota(self, topico):
        """A nota que o tópico tiraria agora, pelo perfil dele.

        Teimoso erra de novo de tempos em tempos; o resto acerta quase sempre,
        com algum "difícil" no meio. É o que separa os dois grupos no painel de
        frágeis sem precisar marcar nada na mão.
        """
        if topico.nome in TEIMOSOS:
            return self.aleatorio.choice([0, 0, 3, 3, 4, 0, 4])
        # O zero solitário é de propósito: quem nunca erra vira tudo "dominado",
        # e a tela de progresso para de querer dizer alguma coisa.
        return self.aleatorio.choice([3, 4, 4, 4, 5, 5, 4, 3, 4, 0])

    # Teto de respostas por tópico: a escada do SM-2 cresce rápido e um semestre
    # não dá para mais que isso. O teto existe para o laço ter fim, não por regra.
    MAXIMO_DE_RESPOSTAS = 30

    def simular_revisoes(self, folhas):
        """Anda a escada do SM-2 tópico a tópico, gravando o log de cada resposta.

        Usa a mesma conta do app (`passo_do_sm2`): o estado que sobra no tópico é
        o estado que ele teria se as respostas tivessem sido dadas de verdade.

        A escada anda até passar de hoje -- quem revisa, revisa quando vence. Só
        depois é que uma parte dos tópicos é empurrada para o atraso, que é o que
        acontece de verdade quando a semana aperta.
        """
        for topico in folhas:
            if topico.nome in AINDA_NAO_VISTOS:
                continue

            facilidade, intervalo, acertos = 2.5, 0, 0
            status = Topico.NAO_INICIADO
            # Nem todo tópico entrou no semestre no mesmo dia: o que começou há
            # duas semanas ainda está nos primeiros degraus, e é dele que vem a
            # fila das próximas semanas. Tudo começando junto deixaria o app com
            # intervalos de três meses e um gráfico de carga vazio.
            quando = self.hoje - timedelta(days=self.aleatorio.randint(14, 100))
            respostas = 0

            while quando < self.hoje and respostas < self.MAXIMO_DE_RESPOSTAS:
                qualidade = self.proxima_nota(topico)
                antes = (status, facilidade, intervalo, acertos)
                facilidade, intervalo, acertos = passo_do_sm2(
                    facilidade, intervalo, acertos, qualidade, self.config
                )
                # "Dominado" é para o que já voltou quatro vezes seguidas sem
                # tropeço; com três, metade da grade viraria dominada e o painel
                # de progresso perderia a graça de significar alguma coisa.
                status = (
                    Topico.ESTUDANDO
                    if qualidade < 3
                    else (Topico.DOMINADO if acertos >= 4 else Topico.REVISADO)
                )

                atraso = self.aleatorio.choice([0, 0, 0, 1, 2])
                respondida_em = timezone.make_aware(
                    datetime.combine(
                        min(quando + timedelta(days=atraso), self.hoje),
                        time(self.aleatorio.randint(8, 22), 0),
                    )
                )
                # A revisão fechada também fica: é dela que sai a contagem de
                # "revisões por semana" do histórico. O log sozinho conta a
                # resposta, não a revisão que existiu.
                revisao = Revisao.objects.create(
                    topico=topico,
                    data_prevista=quando,
                    feita=True,
                    dificil=qualidade < 4,
                    qualidade=qualidade,
                    feita_em=respondida_em,
                )
                RespostaRevisao.objects.create(
                    topico=topico,
                    revisao=revisao,
                    qualidade=qualidade,
                    respondida_em=respondida_em,
                    data_prevista=quando,
                    atraso_dias=atraso,
                    status_antes=antes[0],
                    facilidade_antes=antes[1],
                    intervalo_antes=antes[2],
                    acertos_antes=antes[3],
                    facilidade_depois=facilidade,
                    intervalo_depois=intervalo,
                )
                quando += timedelta(days=max(intervalo, 1))
                respostas += 1

            topico.facilidade = facilidade
            topico.intervalo_dias = intervalo
            topico.acertos_seguidos = acertos
            topico.status = status
            topico.save()

            self.marcar_proxima(topico, quando)

    def marcar_proxima(self, topico, quando):
        """Onde cai a próxima revisão: atrasada, hoje, ou onde o SM-2 mandou.

        Um banco só com revisões futuras não mostra fila, e um só com atrasadas
        parece abandono. A proporção aqui é a de uma semana apertada: a maioria
        em dia, um punhado vencendo hoje, alguns poucos acumulados.
        """
        sorte = self.aleatorio.random()
        if sorte < 0.12:
            atraso = self.aleatorio.randint(1, 6)
            Revisao.objects.get_or_create(
                topico=topico, data_prevista=self.hoje - timedelta(days=atraso), feita=False
            )
        elif sorte < 0.3:
            Revisao.objects.get_or_create(
                topico=topico, data_prevista=self.hoje, feita=False
            )
        else:
            topico.agendar(max((quando - self.hoje).days, 1))

    # ------------------------------------------------------------ avaliações

    def marcar_avaliacoes(self, folhas):
        """Duas provas que passaram com nota, uma entrega feita e a P2 chegando."""
        por_materia = {}
        for topico in folhas:
            por_materia.setdefault(topico.materia.nome, []).append(topico)

        combinados = [
            ("Algoritmos e Estruturas de Dados", "P1", "prova", -63, 7.5, 4, True),
            ("Sistemas Operacionais", "P1", "prova", -58, 6.0, 4, True),
            ("Engenharia de Software", "Entrega do protótipo", "trabalho", -30, 9.0, 2, True),
            ("Algoritmos e Estruturas de Dados", "P2", "prova", 6, None, 4, False),
            ("Banco de Dados", "Trabalho de modelagem", "trabalho", 13, None, 3, False),
            ("Sistemas Operacionais", "P2", "prova", 24, None, 4, False),
        ]

        for materia_nome, titulo, tipo, dias, nota, peso, concluida in combinados:
            materia = Materia.objects.filter(nome=materia_nome).first()
            if not materia:
                continue
            avaliacao, criada = Avaliacao.objects.get_or_create(
                materia=materia,
                titulo=titulo,
                data=self.hoje + timedelta(days=dias),
                defaults={
                    "tipo": tipo,
                    "peso": peso,
                    "nota": nota,
                    "concluida": concluida,
                    "hora": time(19, 0) if tipo == "prova" else None,
                    "descricao": "Sala 204, consulta a uma folha." if tipo == "prova" else "",
                },
            )
            if criada:
                # O que cai: metade do conteúdo da matéria, os teimosos primeiro.
                candidatos = por_materia.get(materia_nome, [])
                caem = [t for t in candidatos if t.nome in TEIMOSOS]
                caem += [t for t in candidatos if t.nome not in TEIMOSOS][
                    : max(len(candidatos) // 2, 3)
                ]
                avaliacao.topicos.set(caem)

    def blocos_da_semana(self):
        """Estudo marcado nesta semana, e um feriado que derrubou uma aula."""
        semana = segunda_da_semana(self.hoje)
        estudo = [
            (0, "19:00", "20:30", "Algoritmos e Estruturas de Dados", "Dijkstra"),
            (1, "20:00", "21:30", "Sistemas Operacionais", "Deadlock"),
            (2, "19:00", "20:00", "Banco de Dados", "Normalização"),
            (3, "20:00", "21:30", "Algoritmos e Estruturas de Dados", "Quicksort"),
            (5, "10:00", "12:00", "Matemática Discreta", "Indução"),
        ]
        for dia, inicio, fim, materia_nome, topico_nome in estudo:
            materia = Materia.objects.filter(nome=materia_nome).first()
            topico = Topico.objects.filter(nome=topico_nome).first()
            BlocoPlanejado.objects.get_or_create(
                tipo=BlocoPlanejado.ESTUDO,
                titulo=f"Revisar {topico_nome}",
                materia=materia,
                topico=topico,
                semana=semana,
                dia_semana=dia,
                hora_inicio=time.fromisoformat(inicio),
                hora_fim=time.fromisoformat(fim),
            )

        # Feriado na quinta: a aula de Redes não acontece nesta semana.
        aula = BlocoPlanejado.objects.filter(
            titulo="Redes de Computadores", semana__isnull=True
        ).first()
        if aula:
            OcorrenciaPulada.objects.get_or_create(bloco=aula, semana=semana)

    # ------------------------------------------------------------------ fim

    def resumir(self, dias_estudados):
        horas = sum(SessaoEstudo.objects.values_list("duracao_min", flat=True)) / 60
        self.stdout.write(
            self.style.SUCCESS(
                f"Semestre montado: {Materia.objects.count()} matérias, "
                f"{Topico.objects.count()} tópicos, {Cartao.objects.count()} cartões, "
                f"{SessaoEstudo.objects.count()} sessões em {len(dias_estudados)} dias "
                f"({horas:.0f}h), {RespostaRevisao.objects.count()} respostas de revisão, "
                f"{Revisao.objects.filter(feita=False).count()} revisões pendentes, "
                f"{Avaliacao.objects.count()} avaliações, "
                f"{BlocoPlanejado.objects.count()} blocos no planner."
            )
        )
