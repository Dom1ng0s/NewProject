# Estudos

Sistema web pessoal para organizar estudos. Uso local, sem login — mas com
perfis, para mais de uma pessoa (ou mais de uma vida de estudo) caberem na
mesma máquina. Django + SQLite no backend; HTML, CSS e JavaScript puro no
frontend (sem npm, sem CDN).

## Rodar do zero

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py popular_dados    # opcional: dados de exemplo
python manage.py runserver
```

Abra http://127.0.0.1:8000/ — a primeira tela pede para criar um perfil.

## Perfis

A porta do app é "Quem está estudando?", no padrão da TV da sala: uma grade de
avatares, um clique, pronto. Não é login e não tem senha — é só a pergunta de
quem está usando agora, guardada num cookie.

**Cada perfil tem os próprios dados.** Matérias, tópicos, cartões, sessões,
revisões, provas, planner e configurações: nada atravessa de um para o outro.
Dois perfis podem cursar "Cálculo" sem disputar o nome, e a meta de horas de
quem faz faculdade não é a de quem estuda para concurso.

O avatar é a inicial sobre a cor escolhida, ou uma foto enviada na hora. A foto
é conferida pelos bytes iniciais, não pela extensão: sem Pillow não dá para
abrir a imagem e perguntar se ela é imagem, e confiar no nome do arquivo nunca
foi conferir nada. Teto de 5MB.

"Gerenciar perfis" é onde se renomeia, troca cor e foto, e exclui. O aviso de
exclusão diz o tamanho do estrago em números do próprio perfil ("vão junto: 6
matérias, 73 tópicos, 117 sessões…"), porque excluir perfil parece apagar um
nome e apaga um semestre.

### Como o isolamento é garantido

O escopo não é escrito consulta a consulta. São mais de cem `.objects.` no app,
e bastaria esquecer uma para a matéria de outra pessoa aparecer numa tela — sem
erro nenhum, o que é o pior jeito de errar. Então o filtro é o padrão:

- `estudos/escopo.py` guarda o perfil atual num `ContextVar` e define o manager
  `PorPerfil`, que já nasce filtrado. Todo modelo com dono herda de `ComDono`,
  cujo `objects` é esse manager.
- O middleware `perfil_atual` resolve o cookie, deixa o perfil valendo durante
  o request e o desfaz no fim — um perfil vazando para o request seguinte seria
  o pior defeito possível aqui.
- O dono se preenche sozinho no `save()`: nos modelos-raiz vem do perfil atual,
  nos que têm pai vem do pai (um cartão é do tópico, um tópico é da matéria).
- Para ver tudo é preciso dizer em voz alta: `Modelo.todos` ou
  `Modelo.de_todos_os_perfis()`. Só a migração e scripts usam.

O efeito prático é que `backup.py`, `services.py` e as views não precisaram de
uma linha de mudança para ficarem isolados — e exportar backup passou a
exportar só o perfil atual, de graça.

Fora de um request (shell, migração) não há perfil definido e o manager não
filtra: filtrar por "ninguém" devolveria nada e transformaria todo script num
mistério. `popular_dados --perfil Ana` roda dentro de um perfil escolhido.

Quem já usava o app antes dos perfis não perde nada: a migração cria um perfil
"Eu" e adota todas as linhas existentes.

## Revisar do celular

Revisar é atividade de fila de ônibus, não de mesa. Para abrir o app no celular,
suba o servidor ouvindo a rede local em vez de só o `localhost`:

```bash
python manage.py runserver 0.0.0.0:8000
```

Depois é `http://<ip-da-máquina>:8000/` no navegador do celular (`ipconfig` no
Windows mostra o IP; na primeira vez o firewall pergunta se libera a porta). O
`ALLOWED_HOSTS` já aceita qualquer host — o app é de uma pessoa, na rede de
casa, e exigir configuração para isso seria burocracia.

A tela de revisão foi feita para 390px: o diálogo ocupa a tela, as quatro notas
ficam em 2x2 ao alcance do polegar, os alvos crescem em aparelho de toque e as
dicas de tecla (`(1)`, `(espaço)`) desaparecem onde não há teclado.

### Como ícone na tela inicial

O app tem manifesto e service worker, então o navegador do celular oferece
"adicionar à tela inicial": vira um ícone (o cubo da marca, gerado por
`python manage.py gerar_icones`), abre sem barra de endereço e carrega a última
tela mesmo sem sinal — o que importa numa fila de ônibus.

O atalho abre em `/agora/`, não no dashboard. Essa URL decide no servidor o que
fazer e já manda para lá: o bloco do planner que cobre esta hora, senão a fila
de revisão, senão o tópico da última sessão. Abrir o app e já estar trabalhando
é a diferença entre abrir amanhã e não abrir.

Uma ressalva honesta: service worker exige contexto seguro. No `localhost` ele
registra; em `http://192.168.x.x:8000` o Chrome do Android recusa, e aí o
atalho vira só um marcador (sem offline). Para instalar de verdade na rede
local, libere a origem em `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
No Safari do iPhone, "Adicionar à Tela de Início" funciona por HTTP: o ícone e
o modo sem barra de endereço vêm, só o offline não.

O número de revisões pendentes vai no título da aba — `(7) Revisar hoje ·
Estudos`. É o lembrete mais barato que existe: cobra no meio das outras abas,
sem notificação, sem permissão e sem app instalado.

## Dados de exemplo

`popular_dados --limpar` apaga tudo antes de popular.

O que ele monta é um semestre de Ciência da Computação inteiro — seis matérias
(AED, SO, Banco de Dados, Redes, Matemática Discreta, Engenharia de Software),
a grade de aulas e o estágio no planner, quatro meses de sessões com uma semana
de sumiço e uma véspera de prova, a escada do SM-2 andando tópico a tópico com
o log de cada resposta, provas que já passaram com nota e uma P2 chegando.
Dado de exemplo só serve se parecer uso de verdade: um banco com três sessões
perfeitas não mostra fila cheia, nem matéria parada, nem tópico frágil — e são
essas telas que precisam ser olhadas antes de confiar nelas.

A semente é fixa, então rodar duas vezes dá o mesmo semestre. Duas coisas são
fabricadas de propósito e estão ditas no próprio arquivo: os tópicos que erram
recebem sessões mais picadas (para o painel de interrupções ter o que comparar)
e a lista de "teimosos" é escrita à mão.

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
| `/perfis/`   | Quem está estudando |

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
configurações, `g b` dados). `n` abre uma sessão nova e `s` puxa uma **carta da
manga** — um cartão ao acaso de um tópico já dominado, sem nota para dar e sem
mexer em intervalo nenhum. É a porta de entrada mais barata do app: custa um
clique, quase sempre é um acerto, e o botão no fim do diálogo transforma a
curiosidade em sessão. O `g` solto é esquecido em um segundo e meio.

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

**Desfazer.** Apertar `1` no lugar de `3` derrubava a facilidade, voltava o
intervalo ao primeiro degrau e já marcava a próxima revisão no dia errado — sem
volta a não ser pelo banco. O botão **Desfazer** no pé da fila (ou a tecla `u`)
devolve o tópico ao estado que o log guardou, recoloca a revisão na fila no dia
em que estava e apaga a que a resposta havia agendado. Só a resposta mais
recente é desfeita, e desfazer de novo desfaz a anterior.

**Teclado.** No diálogo de revisão, espaço revela a resposta ou vai para o
próximo cartão, e `1` a `4` dão a nota (errei, difícil, bom, fácil). Numa fila
de vinte, é a diferença entre revisar e não revisar. Estudar um tópico que já está no meio da escada
não o derruba de volta para o começo.

## Carga futura

O dashboard mostra, numa barra por dia, as **próximas 4 semanas** de revisões já
marcadas — o que o SM-2 criou e ainda não venceu. Dia sem revisão é um traço na
linha de base, não uma caixa vazia (um mês tranquilo não pode parecer defeito),
a linha tracejada é o teto diário e as datas aparecem de semana em semana. Olhar só para trás (o
histórico) diz o que foi feito; isto diz o que vem, que é sobre o que ainda dá
para decidir. O que já venceu e não foi feito pesa no dia de hoje: atrasada não
some do planejamento. A altura cabe o pico e o teto, dia no teto fica vermelho e dia com prova ganha
um pé mais escuro.

Abaixo vêm os **alertas de colisão**: quando a semana anterior a uma prova tem
mais revisões do que o teto diário permitiria naqueles sete dias, o aviso diz o
excedente — "52 revisões na semana da prova, capacidade de 70, antecipe 12 ou
aumente o teto". Sem teto configurado não há capacidade para estourar, e o
alerta não aparece.

## Provas e prazos

Uma avaliação é uma prova, trabalho ou entrega com matéria, data (hora, peso e
nota são opcionais) e, se você marcar, os **tópicos que caem**. Esses tópicos são
o que dá urgência ao resto: a fila de revisão do dashboard e da tela "Revisar
hoje" passa a vir ordenada pela prova mais próxima, com a etiqueta do prazo em
cada linha.

**Plano de ataque.** Com o conteúdo marcado, o botão na linha da avaliação monta
o estudo até a véspera: pega os buracos livres da sua agenda (fora do que já
está na grade, entre 8h e 22h, em blocos de 1h com teto de 3h por dia) e
distribui os tópicos neles, começando pelos que o log diz que você mais erra.
O **Conferir** mostra antes; só o **Gravar no planner** escreve, e os blocos
viram linhas normais do planner — com o tópico junto, o botão "Estudar agora" já
funciona neles. Gravar duas vezes não duplica, e o estudo já marcado conta para
o teto do dia, então rodar de novo não empilha uma segunda jornada por cima da
primeira. O que não coube até a véspera é dito pelo nome, em vez de o plano
fingir que cobre tudo.

É o único lugar do app em que as quatro pontas se encontram — o conteúdo que
cai, a data, o histórico de erros e os horários livres. Nenhuma ferramenta de
fora tem as quatro na mesma base.

O dashboard lista o que vence nos próximos `DIAS_PROXIMAS_AVALIACOES` dias. Uma
avaliação cuja data já passou continua aparecendo enquanto não for marcada como
"já aconteceu" — esquecer de fechar não pode sumir com ela da tela.

## Cartões escritos dentro da nota

Cadastrar cartão era uma tela à parte; resumir o assunto já é o que se faz
naturalmente — e um resumo tem perguntas dentro dele. No diálogo de notas, duas
sintaxes transformam a linha em cartão sem sair do texto:

```
Derivada de x² :: 2x
O Brasil foi colônia até {{c1::1822}}
{{c1::Tiradentes}} morreu em {{c2::1792}}
```

A primeira vira um cartão direto. A linha com lacuna vira **um cartão por
número**: a terceira gera dois, cada um escondendo a sua parte. A lacuna aceita
uma dica (`{{c1::Brasília::cidade}}`), que aparece no lugar do vazio.

O botão **Conferir** mostra o que seria criado sem gravar nada; só o **Gerar
cartões da nota** grava. Pergunta que já existe no tópico não entra de novo, então
rodar de novo depois de acrescentar um parágrafo cria só o que o parágrafo
trouxe. Linha com `::` e um dos lados vazio não vira meio cartão: não vira
cartão. O teto é de 100 cartões por nota.

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
- **Semanas na meta**, a manchete: semanas seguidas em que as horas bateram a
  meta semanal. Numa grade de faculdade o dia de estudo escorrega — a prova
  rouba a terça e devolve o sábado — e a semana é a menor unidade em que isso se
  compensa. A semana corrente não quebra a conta enquanto não acaba.
- **Dias seguidos**, agora com folga. A sequência aceita terminar ontem (o dia
  de hoje ainda não acabou) e perdoa um dia perdido por janela de sete, ajustável
  em `folgas_por_semana` — 0 volta à regra antiga. Uma sequência que morre na
  semana de prova é uma sequência que ninguém recomeça, e quem perde o dia
  costuma ser quem estudou mais naquela semana, não menos. A maior sequência usa
  a mesma regra: dois critérios seriam dois números que nunca se explicam.
- **Últimas 12 semanas** com horas estudadas e revisões fechadas em cada uma.
- **Tópicos com mais tempo** no período — o dashboard só agrega por matéria.
- **Tópicos frágeis**: os que erram de novo. Sai do log de respostas, porque o
  estado do tópico diz onde a escada está, não quantas vezes ela caiu. Entra
  quem tem pelo menos duas respostas em 90 dias e errou alguma — errar uma vez é
  um dia ruim, não uma fragilidade. A ordem soma um ponto por erro e dois pontos
  por unidade de facilidade abaixo de 2.5, então dois erros com a facilidade
  intacta ficam atrás de dois erros que derrubaram a escada.
- **Interrupções e erro**: a média de interrupções por sessão dos tópicos que
  erraram, contra a dos que não erraram. Não prova causa nenhuma — mas é a
  pergunta que o contador de interrupções existe para responder, e nenhuma outra
  ferramenta tem os dois números na mesma base.

## O laço do hábito

Um app de estudo não é abandonado por falta de recompensa — é abandonado porque
a tarefa nunca termina, porque o esforço não aparece em lugar nenhum e porque
nada lembra de começar. As peças abaixo fecham esses três buracos, e nenhuma
delas inventa número: cada uma mostra, na hora em que mudou, um dado que já
estava no banco.

**O fecho do dia.** Quando a fila zera, o anel anda de onde estava até 100%, a
sequência aparece inteira e o que volta amanhã é dito no fim, em letra miúda.
Antes isto era um aviso de canto que sumia em três segundos: terminar a fila era
indistinguível de desistir dela, porque a tela ficava igual nos dois casos. O
movimento do anel é o recado — não o texto. O anel tem um relógio atrás do
`requestAnimationFrame` de propósito: em janela minimizada o `rAF` não roda, e um
anel congelado em 90% numa fila fechada seria um número falso no exato instante
que ele existe para marcar.

**A corrida, no topo.** Uma faixa com os dias seguidos, quantas folgas a semana
ainda perdoa e o que basta para segurar o dia. Ela só aparece quando há uma
sequência em pé e o dia ainda não foi cumprido (`em_risco`): quem não tem
corrida não tem o que perder, e cobrar dessa pessoa é cobrar justamente do dia
em que ela voltou. A formulação é metade do trabalho — "13 dias seguidos · 1
folga de sobra" faz abrir; "você não estudou hoje" faz fechar a aba.

**O fim da sessão, com número.** Salvar deixa de ser um aviso de canto e passa a
dizer o que mudou: minutos, o total do dia, as horas da semana andando para a
meta (e quanto falta, em minutos, porque "faltam 40 min" é acionável e "67% da
meta" não é) e a sequência. As interrupções vão comparadas com a sua própria
média dos últimos 60 dias — o contador de interrupções existe para responder
isso, e até agora a resposta só aparecia no histórico, noventa dias depois. Sem
histórico não há comparação: dizer "0,0 de média" no primeiro dia seria inventar
um recorde para quebrar.

**A carta da manga na tela.** A pergunta já aberta quando o dashboard carrega, de
um tópico já dominado, sem nota para dar e sem nada do SM-2 se movendo. O botão
continua existindo (tecla `s`, em qualquer tela), mas quase ninguém aperta um
botão para começar — e o custo de entrada é o que mata app de estudo, não a falta
de recompensa. Quem respondeu uma pergunta já está estudando.

**Desde o começo.** No fim do dashboard, o total de sempre: horas, dias de
estudo, revisões fechadas, tópicos dominados. É o único lugar em que o passado
inteiro aparece de uma vez — o resto do app olha para a semana ou para os últimos
180 dias. Não decide nada hoje, e é por isso que fica no fim; serve para a conta
existir, porque quanto maior ela fica, mais caro fica abandonar.

**Marcos.** Fatos raros ditos em voz alta, uma vez só: o primeiro tópico
dominado de cada matéria, um intervalo que passou de 90 dias, 7/30/100 dias
seguidos, 4/12 semanas na meta, 100/500/1000 revisões, uma matéria que volta
depois de parada. Não são pontos nem moeda — a diferença prática é que não há o
que clicar para ganhar "90 dias de intervalo". A tabela `Marco` guarda só o "já
falei disso", porque um parabéns repetido deixa de ser parabéns em dois dias.

A primeira passada de um perfil **semeia em silêncio**: um app que acabou de
importar um backup — ou que ganhou esta função com um ano de histórico dentro —
tem dezenas de marcos verdadeiros de uma vez, e trinta parabéns juntos não são
trinta parabéns, são ruído. A semeadura é uma linha gravada (`_semeado`) e não a
ausência de linhas: inferir "primeira passada" do vazio faria o primeiro marco
real de um perfil novo cair no silêncio da semeadura, uma vez só e para sempre.

Pedir os marcos é um `POST /api/marcos/`, nunca um GET: a chamada é o que grava
que eles já foram ditos, e um `F5` no caminho entre a conta e o aviso engoliria o
parabéns. O front só pede depois de a tela estar montada.

**O lembrete do dia.** O único gatilho que vem de fora da tela, e a única peça do
hábito que não se resolve dentro dela. Liga em `/configuracoes/`, desligado por
padrão. A hora vem, na ordem de quem sabe mais: o bloco de hoje no planner (ele
diz a intenção, e bloco pulado não conta), a hora mais frequente das suas sessões
(ela diz o hábito) ou 19h. Lembrar às 7h quem estuda às 22h é o jeito mais rápido
de a pessoa desligar o lembrete — e um desligado não lembra nada.

Sai uma vez por dia e só quando ainda há algo a fazer: dia cumprido não rende
notificação, porque notificação sem conteúdo é o que ensina a ignorar as
próximas. O texto diz o que está em jogo, nunca o que foi falhado.

O alcance é honesto e limitado: **sem servidor não há push**. O aviso sai ao
abrir o app depois da hora, e o service worker tenta de novo em segundo plano
onde o navegador deixa (`periodicSync`, hoje só em PWA instalado no Chrome, e com
o navegador decidindo a hora de verdade). Clicar no lembrete abre `/agora/` — a
mesma porta do atalho da tela inicial — reaproveitando uma aba já aberta.

**O que não foi feito, de propósito:** sequência que zera sem folga (perda de
streak é o principal evento de abandono em app de hábito), dívida na manchete
(ver "Revisão"), moeda, XP, recompensa aleatória e ranking. Recompensa aleatória
descola o reforço do conteúdo: a pessoa passa a otimizar o clique, não a memória
— e num app de SM-2 isso degrada o próprio algoritmo, porque incentiva responder
"fácil" para avançar mais rápido.

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
| Folgas por semana | `1` | Dias que a sequência perdoa em cada sete |
| Lembrar de estudar | desligado | Liga o lembrete do dia |
| Hora do lembrete | vazio | Vazio = o horário em que você costuma estudar |
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

Isso resolvia metade do problema. Quem carrega a URL versionada é o **HTML**, e
ele não tinha versão nenhuma: uma página guardada pelo navegador continuava
pedindo o `?v=` antigo, e o CSS velho voltava junto — com cara de bug, não de
cache (um gráfico sem as regras da faixa vira uma fileira de rótulos colados).
Por isso o `estudos.middleware.html_sem_cache` manda `Cache-Control: no-store`
em toda página: o app é local e de uma pessoa, renderizar de novo custa
milissegundos. Os estáticos continuam cacheáveis, que é o que o `?v=` permite.

`estilo.css` só faz `@import` dos outros arquivos, e a data dele nunca muda —
por isso a versão usada é a **mais recente entre o arquivo e tudo que ele
importa**, recursivamente. Sem isso, editar `telas.css` não invalidava nada e o
navegador continuava servindo o CSS velho.

Falta a outra metade: quem versiona é **quem escreve a URL**, e o `@import` não
versiona nada. `componentes.css` e companhia são sempre pedidos no mesmo
endereço, então o service worker os guardava cache-primeiro e eles sobreviviam à
própria edição — o `?v=` da folha de entrada mudava, o navegador baixava a folha
nova, e ela importava a versão velha das partes. Por isso o `sw.js` só usa
cache-primeiro em `/static/` **quando a URL tem `?v=`**; sem versão, vai pela
rede. Era o único ponto em que a regra de cache contrariava a própria razão dela.
