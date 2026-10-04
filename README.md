# Estudos

Sistema web pessoal para organizar estudos. Uso local, sem login.
Django + SQLite no backend; HTML, CSS e JavaScript puro no frontend (sem npm, sem CDN).

## Rodar do zero

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py popular_dados    # opcional: dados de exemplo
python manage.py runserver
```

Abra http://127.0.0.1:8000/

`popular_dados --limpar` apaga tudo antes de popular.

## Telas

| Rota         | Tela                |
| ------------ | ------------------- |
| `/`          | Dashboard           |
| `/materias/` | Matérias e tópicos  |
| `/sessao/`   | Sessão de estudo    |
| `/planner/`  | Planner semanal     |
| `/quadro/`   | Quadro kanban       |
| `/revisar/`  | Revisar hoje        |
| `/avaliacoes/` | Provas e prazos   |
| `/historico/` | Histórico          |
| `/configuracoes/` | Configurações  |
| `/dados/`    | Backup: exportar e importar |

## Sessão de estudo e pomodoro

O cronômetro tem dois modos. No **livre** ele só conta; no **pomodoro** alterna
foco e pausa, e a cada `POMODORO_CICLOS_ATE_PAUSA_LONGA` focos fechados a pausa
vira longa (`POMODORO_PAUSA_LONGA_MIN`). O painel mostra em que ciclo você está.

Quando a fase vira, o aviso na tela some sozinho e a aba costuma estar no fundo
— por isso também há **dois bipes** (WebAudio, sem arquivo para baixar), uma
**notificação do sistema** (se você permitir, pedida no primeiro clique em
Iniciar) e o **tempo restante no título da aba**. Dá para desligar o som e a
notificação no próprio painel.

O botão **Interrupção** conta quantas vezes o foco foi quebrado, e o número vai
junto com a sessão: 50 minutos com nove interrupções não são os mesmos 50
minutos de uma sessão inteiriça.

O estado fica no `localStorage`, então o cronômetro sobrevive a recarregar e
fechar a aba — e os controles voltam mostrando o que está rodando, não os
padrões.

No planner, o botão **Estudar agora** de um bloco abre a sessão já com o tópico
escolhido e o foco do tamanho do bloco. Bloco sem tópico não tem de onde partir,
e o botão fica desligado.

O dashboard tem o mesmo atalho em cima de tudo: **Continuar** escolhe o tópico
por conta própria — o bloco do planner que cobre a hora atual, com o foco do
tamanho do que resta dele, ou, sem bloco, o tópico da última sessão — e o
cronômetro já começa a contar quando a tela abre. Abrir o app e estar estudando
é um clique. Sem bloco e sem nenhuma sessão, não há o que continuar e o cartão
não aparece.

## Atalhos de teclado

A busca abre com `/` e a lista de atalhos com `?`. Navegar é um acorde: `g` e
depois a letra da tela (`g d` dashboard, `g s` sessão, `g r` revisar, `g m`
matérias, `g p` planner, `g a` provas, `g q` quadro, `g h` histórico, `g c`
configurações, `g b` dados). `n` abre uma sessão nova. O `g` solto é esquecido
em um segundo e meio.

Na tela de matérias, as teclas agem sobre o **tópico em foco** (o foco chega na
linha pelo Tab): `c` abre os cartões, `e` as notas, `t` cria um subtópico. Sem
linha em foco o app avisa, em vez de escolher um tópico qualquer.

Atalho de uma letra nunca rouba a tecla de quem está escrevendo num campo, e
nunca dispara com um diálogo aberto — o de revisão tem as teclas dele.

## Revisão: cartões e repetição espaçada

Cada tópico pode ter **cartões** — pergunta de um lado, resposta do outro,
cadastrados pelo botão de cartão na árvore de matérias. Na tela "Revisar hoje" a
pergunta aparece sozinha; a resposta só depois do clique. Tópico sem cartão
continua revisável: você relembra pelo caderno e responde como foi.

No fim da revisão vêm quatro notas — **errei, difícil, bom, fácil** — e é a nota
que decide quando o tópico volta, pelo SM-2:

- Cada tópico guarda uma `facilidade` (começa em 2.5), o último `intervalo_dias`
  e quantos acertos seguidos tem.
- Acertou: 1º acerto volta em `PRIMEIRO_INTERVALO_DIAS`, o 2º em
  `SEGUNDO_INTERVALO_DIAS`, e daí em diante o intervalo é multiplicado pela
  facilidade. "Fácil" aumenta a facilidade, "difícil" derruba, "bom" quase não
  mexe.
- Errou: a escada volta ao primeiro degrau e a facilidade cai, mas nunca abaixo
  de `FACILIDADE_MINIMA`.

**Log das respostas.** Cada nota dada vira uma linha em `RespostaRevisao`, com o
estado do tópico antes e depois: a nota, o atraso em dias, a facilidade e o
intervalo nos dois lados. O tópico guarda só a facilidade de agora; "errei este
assunto três vezes em maio" existe apenas no log. É dele que saem os tópicos
frágeis e é ele que permite desfazer uma nota dada por engano.

**A revisão nunca acaba**: fechar uma sempre agenda a próxima, e existe no
máximo uma pendente por tópico.

**Teto diário.** Cadastrar trinta tópicos num domingo faria todos voltarem
juntos, e um dia impossível é um dia pulado — que derruba a escada de todos de
uma vez. Por isso o agendamento respeita um teto (`Revisões por dia`, 10 por
padrão): dia cheio escorrega para o próximo com vaga, sem mexer no intervalo que
o SM-2 calculou. A fila de hoje também é cortada no teto, incluindo as
atrasadas, e vem ordenada pela prova mais próxima — o corte deixa passar o que
mais urge.

**Teclado.** No diálogo de revisão, espaço revela a resposta ou vai para o
próximo cartão, e `1` a `4` dão a nota (errei, difícil, bom, fácil). Numa fila
de vinte, é a diferença entre revisar e não revisar. Estudar um tópico que já está no meio da escada
não o derruba de volta para o começo.

## Provas e prazos

Uma avaliação é uma prova, trabalho ou entrega com matéria, data (hora, peso e
nota são opcionais) e, se você marcar, os **tópicos que caem**. Esses tópicos são
o que dá urgência ao resto: a fila de revisão do dashboard e da tela "Revisar
hoje" passa a vir ordenada pela prova mais próxima, com a etiqueta do prazo em
cada linha.

O dashboard lista o que vence nos próximos `DIAS_PROXIMAS_AVALIACOES` dias. Uma
avaliação cuja data já passou continua aparecendo enquanto não for marcada como
"já aconteceu" — esquecer de fechar não pode sumir com ela da tela.

## Notas, material e busca

Cada tópico guarda um **resumo livre** e o **material** de onde o assunto foi
estudado — um link ou um arquivo anexado (PDF, imagem), com a página ou capítulo
ao lado. Tudo pelo botão de notas na árvore de matérias.

Os arquivos anexados ficam em `arquivos/` (fora do git). O limite por arquivo é
`MATERIAL_MAXIMO_BYTES`.

A **busca global** fica no topo de todas as telas e também abre com `/`. Ela
procura em matérias, tópicos, notas, cartões, material, provas, notas de sessão
e blocos do planner, e **ignora acento e maiúscula**: procurar `calculo` acha
`Cálculo`. O filtro roda em Python porque o `icontains` do SQLite não ignora
acento — o banco é de uma pessoa só, então varrer algumas centenas de linhas sai
de graça.

## Histórico

A tela `/historico/` olha para trás, onde o dashboard só olha para a semana
corrente:

- **Mapa de constância** das últimas 26 semanas, uma coluna por semana e uma
  linha por dia. A intensidade de cada quadrado é relativa ao melhor dia do
  período, então um mês fraco continua legível.
- **Sequência atual e maior sequência** de dias seguidos com pelo menos uma
  sessão. A sequência atual aceita terminar ontem — o dia de hoje ainda não
  acabou, e zerar a contagem às 00h01 só puniria quem estuda de manhã.
- **Últimas 12 semanas** com horas estudadas e revisões fechadas em cada uma.
- **Tópicos com mais tempo** no período — o dashboard só agrega por matéria.

## Testes

```bash
python manage.py test estudos
```

Cobrem as regras que não aparecem na tela: geração e reagendamento de revisões,
contas do dashboard, a escada do SM-2, sequências e mapa do histórico, busca sem acento,
interrupções da sessão, teto diário de revisões,
prioridade que as provas dão à fila,
leitura de `.ics` e ida e volta do backup.

## Backup

A tela `/dados/` baixa um JSON com matérias, tópicos, sessões, blocos do planner,
cartões, notas, links de material, avaliações, revisões, o log de respostas e os ajustes — é a única cópia dos dados, já que o banco é um SQLite local.

Na importação, **somar** reaproveita o que já existe (matéria pelo nome, tópico
pelo nome dentro do mesmo pai, sessão pelo instante de início, bloco pelo título
mais dia e horário), então reimportar o mesmo arquivo não duplica nada.
**Substituir** apaga o banco antes de gravar. Backups das versões anteriores continuam
sendo lidos (1: antes das avaliações, 2: antes dos cartões, 3: antes das notas,
4: antes das interrupções, 5: antes dos ajustes, 6: antes do log de respostas).

Arquivo anexado não cabe num JSON: o backup leva só os links, e a cópia dos
anexos é copiar a pasta `arquivos/`. Um arquivo com qualquer campo
inválido é recusado inteiro: a importação roda numa transação só.

## Planner semanal

A semana é uma grade por horário, de segunda a domingo. Um bloco pode ser:

- **toda semana** (`semana` nula no banco): aulas fixas, academia, trabalho.
  Aparece em todas as semanas, inclusive nas futuras.
- **só daquela semana**: o bloco de estudo pontual.

Numa semana específica, um bloco recorrente pode ser pulado (feriado, aula
cancelada) sem apagar a recorrência — isso vira uma linha em `OcorrenciaPulada`.
Ocorrência pulada não entra na conta de "planejado".

Blocos têm tipo (aula / estudo / outro) e título livre, e a matéria é opcional:
um compromisso sem matéria ocupa a grade mas fica fora do comparativo por
matéria.

## Importar .ics

O card "Importar .ics" no planner lê um arquivo iCalendar (a exportação do
calendário da faculdade, do Google Agenda etc.). O leitor está em
`estudos/ical.py` e usa só biblioteca padrão — nenhuma dependência nova.

- Evento com `RRULE:FREQ=WEEKLY` vira bloco recorrente; `BYDAY=MO,WE` cria um
  bloco por dia listado.
- Evento sem repetição vai para a semana da própria data.
- Fuso: `TZID` e horários em UTC (`...Z`) são convertidos para o fuso do app
  via `zoneinfo`.
- São ignorados, com o motivo na tabela: evento de dia inteiro, evento que
  atravessa a meia-noite e repetição que já terminou (`UNTIL` no passado).
- A matéria é detectada pelo nome dentro do título do evento, ou fixada no
  seletor antes de importar.

O botão "Conferir" mostra o que seria importado sem gravar nada; só o
"Importar" grava. Reimportar o mesmo arquivo não duplica: blocos iguais
(título, dia, horário e semana) são reconhecidos como já existentes.

## Configurações

Os ajustes ficam no banco e mudam pela tela `/configuracoes/` — não é preciso
editar código. Há um botão para voltar tudo ao padrão, e eles entram no backup.

| Ajuste | Padrão | O que faz |
| --- | --- | --- |
| Primeiro intervalo | `1` | Dias até a 1ª revisão |
| Segundo intervalo | `6` | Dias após o 2º acerto |
| Teto do intervalo | `365` | Máximo entre revisões |
| Facilidade mínima | `1.3` | Piso da facilidade do SM-2 |
| Revisões por dia | `10` | Teto da fila; `0` desliga |
| Meta semanal | `10` | Horas por semana |
| Matéria parada | `7` | Dias sem estudar até o aviso |
| Provas no dashboard | `30` | Horizonte das provas |
| Foco / pausa / pausa longa | `25` / `5` / `15` | Minutos do pomodoro |
| Ciclos até a pausa longa | `4` | Focos antes do descanso longo |

Mudar um ajuste vale da próxima revisão agendada em diante: o que já está
marcado não se move.

Em `config/settings.py` sobrou só o que não é preferência, como
`MATERIAL_MAXIMO_BYTES` (teto do arquivo anexado, 25 MB).

## Estáticos e cache

O `runserver` não manda cabeçalho de expiração, então o navegador tende a
reaproveitar um CSS ou JS antigo depois de uma edição. Os templates usam
`{% estatico 'css/estilo.css' %}` (em `estudos/templatetags/estaticos.py`) no
lugar de `{% static %}`: a tag acrescenta `?v=<data de modificação>` à URL, o
que troca o endereço a cada alteração e dispensa recarregar com Ctrl+Shift+R.

`estilo.css` só faz `@import` dos outros arquivos, e a data dele nunca muda —
por isso a versão usada é a **mais recente entre o arquivo e tudo que ele
importa**, recursivamente. Sem isso, editar `telas.css` não invalidava nada e o
navegador continuava servindo o CSS velho.
