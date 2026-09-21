# Prompt de Produção: Webapp de Rotina Pessoal (Estudos, Finanças e Treino)

## 1. Seu papel

Você é o engenheiro responsável por construir este produto do zero até um MVP utilizável em produção. Trabalhe como um Tech Lead cuidadoso: proponha antes de implementar, entregue em incrementos pequenos e testáveis, e registre as decisões importantes.

## 2. Contexto do produto

Um webapp para estudantes e jovens adultos organizarem três áreas da rotina: estudos e projetos, finanças pessoais e treino (força e cardio). O uso é 100% individual. O objetivo é que o usuário abra o app todos os dias porque registrar algo leva segundos e o retorno visual é imediato.

Nome provisório: `[NOME DO APP]`. Idioma da interface: português do Brasil.

## 3. Princípios não negociáveis

1. **Nenhum dado entra sem ação do usuário.** Tudo vem de digitação manual ou de um arquivo que o próprio usuário escolhe importar. Proibido: Open Finance, APIs de saúde, wearables conectados, extensões que monitoram navegação, leitura de contatos, localização em segundo plano.
2. **Local-first.** O app funciona completo sem conta e sem internet. Os dados ficam no dispositivo. Sincronização em nuvem, se existir no futuro, será opcional e não faz parte deste escopo.
3. **O usuário é dono dos dados.** Exportação e importação completas em JSON (backup) e CSV (por módulo) desde a primeira versão. Opção de apagar tudo com confirmação.
4. **Sem recursos sociais.** Nada de feed, ranking, compartilhamento, amigos ou tarefas em grupo.
5. **Sem rastreamento de terceiros.** Nenhum SDK de analytics, anúncios ou pixel. Se houver telemetria, ela é opt-in, anônima e documentada.
6. **Registro rápido acima de tudo.** Qualquer registro frequente (gasto, série de treino, sessão de foco) deve caber em no máximo 3 interações a partir da tela inicial.

## 4. Stack

A stack **ainda não foi definida**. Antes de escrever qualquer código:

1. Proponha **duas opções de stack** compatíveis com os princípios acima (em especial local-first e funcionamento offline).
2. Para cada opção, liste prós, contras, custo de manutenção e como cada uma resolve persistência local, migrações de schema e testes.
3. Recomende uma e **aguarde aprovação** antes de iniciar a Fase 0.

Critérios que a stack escolhida precisa atender: tipagem estática, execução offline, persistência local com suporte a migrações, boa ferramenta de testes unitários e end-to-end, e instalação no celular pela tela inicial.

## 5. Arquitetura

- **Módulos por domínio:** `nucleo` (configurações, backup, tela Hoje, gamificação), `estudos`, `financas`, `treino`. Um módulo não acessa o armazenamento de outro diretamente; a comunicação passa por interfaces públicas.
- **Regras de negócio como funções puras**, separadas da interface e da persistência. Todos os cálculos da seção 7 devem ser testáveis sem renderizar nada.
- **Camada de repositório** abstraindo a persistência, para que o mecanismo de armazenamento possa mudar sem tocar nas regras.
- **Schema versionado** com migrações explícitas e testadas. Nunca quebrar dados de uma versão anterior.
- **Convenções de dados:**
  - IDs em UUID v7 (ordenáveis por tempo).
  - Datas em ISO 8601; datas "de calendário" (dia do treino, dia do gasto) guardadas como data local, sem hora.
  - Dinheiro em **centavos inteiros** (nunca ponto flutuante). Moeda padrão BRL.
  - Peso em kg por padrão, com opção de lb na configuração. Distância em km.
  - Soft delete com `deletedAt` para permitir desfazer.
- **Decisões arquiteturais** registradas em ADRs curtos na pasta `docs/adr/`.

## 6. Escopo funcional

### 6.1 Pilar Estudos e Projetos

#### Radar de Foco
- Timer de sessão em modo Pomodoro (duração configurável) ou livre.
- Cada sessão pertence a uma matéria ou projeto cadastrado pelo usuário.
- Ao encerrar, o usuário avalia a sessão: `focada` ou `dispersa`, com nota opcional.
- O timer continua correto se a aba for fechada ou o app for para segundo plano (calcular pelo horário de início, não por contagem de ticks).
- Visualizações: heatmap anual de minutos focados por dia e totais da semana por matéria.

**Critérios de aceite**
- Dado que iniciei uma sessão de 25 min e fechei o app por 10 min, quando reabro, o timer mostra 15 min restantes.
- Sessões marcadas como `dispersa` aparecem no histórico, mas com peso visual diferente no heatmap.

#### Mapa de Domínio (flashcards)
- Cards de frente e verso, agrupados em tópicos dentro de uma matéria.
- Agendamento por repetição espaçada com o algoritmo **FSRS**. Use uma implementação aberta, mantida e testada; não reescreva o algoritmo.
- Avaliação da revisão em 4 botões: `Errei`, `Difícil`, `Bom`, `Fácil`.
- Cada tópico exibe uma barra de **saúde** (ver 7.1).
- Importação de baralhos do Anki (`.apkg` ou texto exportado) como funcionalidade secundária.

**Critérios de aceite**
- A fila do dia mostra apenas cards vencidos, com contador visível na tela Hoje.
- A saúde de um tópico cai com o passar dos dias sem revisão, mesmo sem nenhuma interação do usuário.

#### Painel de Prazos com Risco
- Cadastro de prova ou entrega com: título, matéria, data, horas estimadas de trabalho.
- O usuário registra o progresso subtraindo horas feitas (ou o app sugere a partir das sessões de foco daquela matéria, pedindo confirmação).
- Cada prazo recebe status `verde`, `amarelo` ou `vermelho` (ver 7.2).

**Critérios de aceite**
- Com média de 8 h de foco por semana e 12 h de trabalho restante para daqui a 5 dias, o prazo aparece como `vermelho`.
- Sem histórico de foco suficiente, o cálculo usa a meta semanal definida pelo usuário no onboarding.

### 6.2 Pilar Finanças Pessoais (entrada manual)

#### Gasto em 3 Toques
- Lançamento com valor, categoria e (opcional) descrição. Data padrão: hoje.
- Categorias editáveis, com um conjunto inicial sensato (alimentação, transporte, lazer, estudos, moradia, outros).
- Orçamento mensal definido pelo usuário.
- A tela inicial mostra o **disponível para hoje** (ver 7.3).
- Registro de entradas (mesada, salário, freela) opcional.

**Critérios de aceite**
- Do toque no botão de adicionar até o gasto salvo: no máximo 3 interações quando a categoria é uma das 4 mais usadas.
- O disponível para hoje é recalculado imediatamente após cada lançamento, edição ou exclusão.

#### Controle de Assinaturas
- Cadastro manual: nome, valor, periodicidade (mensal ou anual), próxima cobrança.
- Aviso configurável X dias antes da renovação (notificação local, sem servidor).
- Total mensal e total anual somados em destaque.
- Botão `usei hoje` para registrar uso e calcular custo por uso no mês.

**Critérios de aceite**
- Ao passar a data de cobrança, o app gera automaticamente o lançamento de gasto correspondente e avança a próxima data.
- Uma assinatura sem nenhum uso registrado no mês aparece sinalizada.

#### Cofrinhos com Projeção
- Metas com nome, valor alvo e prazo opcional.
- Depósitos e retiradas manuais.
- Gráfico de progresso com **projeção da data de conclusão** (ver 7.4).

**Critérios de aceite**
- Após um depósito acima da média, a data projetada fica mais próxima na mesma tela, sem recarregar.

### 6.3 Pilar Treino (força e cardio)

#### Diário de Treino com Sobrecarga Progressiva
- Biblioteca de exercícios com grupo muscular primário e secundários. O usuário pode criar exercícios.
- Fichas prontas (ABC, Upper/Lower, Push/Pull/Legs) e fichas personalizadas.
- Cada exercício na ficha tem faixa de repetições alvo (ex.: 8 a 12) e incremento de carga configurável.
- Durante o treino: registro de série com carga e repetições, sempre mostrando o que foi feito na **última sessão** daquele exercício.
- Sugestão de carga para a próxima sessão (ver 7.5).
- Timer de descanso entre séries, iniciado automaticamente ao salvar uma série.
- 1RM estimado por exercício (ver 7.6).
- A tela de treino precisa funcionar bem com uma mão só e com a tela bloqueando e desbloqueando.

**Critérios de aceite**
- Registrar uma série repetindo os valores da anterior exige 1 toque.
- Um treino interrompido (app fechado no meio) é retomado de onde parou.

#### Log de Cardio
- Modalidades: corrida, caminhada, bike, esteira, elíptico, corda, outro.
- Registro manual de data, duração, distância (quando aplicável) e esforço percebido (RPE de 1 a 10).
- Pace e velocidade média calculados automaticamente.
- Importação opcional de arquivo **GPX ou FIT** escolhido pelo usuário. O parsing acontece no dispositivo. Por padrão, **as coordenadas são descartadas** e só distância, duração e data são mantidas; guardar o trajeto é uma opção explícita.
- Painel com volume semanal (minutos e km) e evolução do pace em distâncias de referência (ex.: melhor 5 km).

**Critérios de aceite**
- Importar um arquivo GPX válido cria uma atividade com distância e duração corretas, sem salvar coordenadas quando a opção está desligada.

#### Mapa Muscular e Recordes
- Ilustração do corpo (frente e costas) com cada grupo muscular colorido conforme as **séries da semana** (ver 7.7).
- Nos dias sem treino registrado, o mapa alterna para o modo **recuperação** (ver 7.8), sempre rotulado como estimativa.
- Detecção automática de recordes pessoais: maior carga, maior 1RM estimado, maior volume numa sessão, melhor pace por distância.
- Sequência contada em **semanas** que bateram a meta de treinos, nunca em dias.

**Critérios de aceite**
- Um novo recorde é destacado no fim do treino e fica registrado numa lista de recordes com data.
- O mapa é acessível: cada grupo muscular tem rótulo textual e o valor numérico, não depende só de cor.

### 6.4 Núcleo

#### Tela Hoje
A tela inicial reúne, sem rolagem excessiva no celular:
- Disponível para gastar hoje.
- Botão de iniciar sessão de foco.
- Quantidade de flashcards para revisar.
- Treino previsto na ficha (ou "dia de descanso" com o mapa de recuperação).
- Prazo mais urgente e seu status.
- Atalho de lançamento rápido para gasto, série e sessão.

#### Gamificação (leve)
- XP por ações concluídas nos três pilares, com níveis por pilar.
- Sem punição agressiva: perder uma sequência nunca apaga histórico ou nível.
- Nenhuma mecânica que incentive comportamento prejudicial (ex.: treinar todo dia sem descanso, gastar para ganhar pontos).

#### Configurações e dados
- Onboarding curto: metas semanais de foco e de treino, orçamento mensal, unidades.
- Exportar tudo (JSON), exportar por módulo (CSV), importar backup, apagar tudo.
- Tema claro e escuro, seguindo o sistema por padrão.

## 7. Regras de cálculo

Todas as regras abaixo devem existir como funções puras com testes unitários cobrindo casos de borda.

### 7.1 Saúde do tópico
Média da probabilidade de lembrança (retrievability do FSRS) dos cards do tópico no momento da consulta, exibida de 0 a 100%. Tópico sem cards revisados: estado "novo", sem porcentagem.

### 7.2 Risco de prazo
```
capacidadeDiaria = média de horas de foco por dia nos últimos 28 dias
                   (ou metaSemanal / 7 se houver menos de 7 dias de histórico)
capacidade       = capacidadeDiaria × dias até o prazo (incluindo hoje)
carga            = horas restantes deste prazo
                   + horas restantes de todos os prazos com data anterior ou igual
razao            = carga / capacidade
```
`verde` se razao < 0,7 · `amarelo` se 0,7 ≤ razao ≤ 1,0 · `vermelho` se razao > 1,0. Prazo vencido e não concluído: `vermelho` com rótulo "atrasado".

### 7.3 Disponível para hoje
```
restanteMes    = orcamentoMes − gastosDoMesAteOntem − assinaturasAVencerNoMes
diasRestantes  = dias do mês de hoje até o último dia, incluindo hoje
cotaDiaria     = restanteMes / diasRestantes
disponivelHoje = cotaDiaria − gastosDeHoje
```
Pode ficar negativo; nesse caso, exibir em destaque o valor excedido. Arredondamento sempre em centavos inteiros.

### 7.4 Projeção de cofrinho
Média de depósitos líquidos por semana nas últimas 8 semanas (ou desde a criação, se menor). Data projetada = hoje + (valor faltante / média semanal) semanas. Média zero ou negativa: exibir "sem projeção" em vez de uma data.

### 7.5 Sugestão de carga (dupla progressão)
- Todas as séries válidas da última sessão atingiram o **topo** da faixa de repetições: sugerir carga + incremento configurado.
- Alguma série ficou abaixo do **mínimo** da faixa em **duas sessões seguidas**: sugerir reduzir cerca de 10%, arredondado para o incremento disponível.
- Caso contrário: manter a carga e tentar mais repetições.
- A sugestão é sempre editável e nunca preenche sozinha sem o usuário ver.

### 7.6 1RM estimado (Epley)
```
1RM = carga × (1 + repeticoes / 30)
```
Com 1 repetição, 1RM = carga. Não calcular para séries acima de 12 repetições (estimativa pouco confiável); exibir "—".

### 7.7 Séries semanais por grupo muscular
Cada série conta 1 para o grupo primário do exercício e 0,5 para cada grupo secundário. Semana de segunda a domingo. Faixas de cor: abaixo de 10 (baixo), 10 a 20 (faixa de referência), acima de 20 (alto). Faixas configuráveis.

### 7.8 Recuperação estimada
Janela padrão de 48 h por grupo muscular desde o último treino que o envolveu. Se aquela sessão teve 6 ou mais séries para o grupo, janela de 72 h. Exibir como porcentagem do tempo decorrido na janela. Sempre rotular como estimativa baseada em tempo, sem sugerir diagnóstico.

### 7.9 Pace
`pace = duração / distância`, exibido em `mm:ss /km`. Velocidade em km/h com uma casa decimal.

## 8. Requisitos não funcionais

- **Mobile-first e responsivo**, utilizável de 360 px de largura até desktop.
- **Offline completo** para todas as funcionalidades do escopo.
- **Instalável** na tela inicial do celular.
- **Acessibilidade WCAG 2.2 nível AA**: contraste, navegação por teclado, rótulos para leitores de tela, alvos de toque de no mínimo 44 × 44 px, respeito a `prefers-reduced-motion`.
- **Desempenho:** tela Hoje interativa em menos de 2 s num celular intermediário; salvar um registro sem atraso perceptível (menos de 100 ms de resposta visual).
- **Localização pt-BR:** moeda `R$ 1.234,56`, datas `dd/mm/aaaa`, semana começando na segunda. Textos centralizados em arquivos de tradução, mesmo com um idioma só.
- **Privacidade e LGPD:** política de privacidade simples explicando que os dados ficam no dispositivo; nenhum dado pessoal enviado a servidores no escopo atual.
- **Resiliência:** nenhuma perda de dados por fechamento inesperado; gravações atômicas; backup automático local periódico, com as últimas N cópias.

## 9. Qualidade e processo

- Tipagem estática em todo o código, sem escapes do tipo `any` sem justificativa comentada.
- Lint e formatação automáticos, verificados no CI.
- **Testes:**
  - Unitários para todas as regras da seção 7 e para as migrações de schema.
  - End-to-end para os fluxos críticos: registrar gasto, registrar treino completo, revisar flashcards, exportar e importar backup.
  - Teste automatizado de acessibilidade nas telas principais.
- CI rodando lint, tipos, testes e build a cada push.
- Commits seguindo Conventional Commits; PRs pequenos, com descrição do que muda e como testar.
- `README` com como rodar, testar e fazer build; `docs/adr/` com as decisões; `CHANGELOG` por versão.
- Dados de exemplo (seed) para desenvolvimento, nunca carregados em produção.

## 10. Plano de entrega

Entregue em fases. Ao fim de cada fase, pare, descreva o que foi feito, o que ficou pendente e aguarde revisão.

| Fase | Conteúdo |
|------|----------|
| 0 | Proposta de stack aprovada, estrutura do projeto, CI, lint, testes rodando, camada de persistência com migrações, exportar e importar backup |
| 1 | Pilar Treino completo (diário, cardio, mapa muscular, recordes) |
| 2 | Radar de Foco e Painel de Prazos |
| 3 | Mapa de Domínio (flashcards com FSRS) |
| 4 | Pilar Finanças completo |
| 5 | Tela Hoje, gamificação, onboarding, polimento de acessibilidade e desempenho |

## 11. Definition of Done

Uma funcionalidade só está pronta quando:
- Todos os critérios de aceite passam.
- Regras de negócio têm testes unitários, e o fluxo principal tem teste end-to-end.
- Funciona offline e sobrevive ao fechamento do app no meio da ação.
- Passa na verificação automática de acessibilidade e foi testada com teclado.
- Está coberta pela exportação e importação de backup.
- Não adiciona nenhuma dependência que envie dados para fora do dispositivo.

## 12. Fora do escopo

- Qualquer recurso social ou colaborativo.
- Contas de usuário, login e sincronização em nuvem.
- Integrações automáticas com bancos, plataformas de ensino, apps de saúde ou wearables.
- Recomendações médicas, nutricionais ou financeiras personalizadas.
- Monetização, anúncios e compras dentro do app.

## 13. Como trabalhar comigo

- Quando algo neste documento for ambíguo, pergunte antes de decidir sozinho. Se a dúvida for pequena, siga a opção mais simples e registre a suposição.
- Prefira soluções simples e legíveis a abstrações antecipadas.
- Não adicione funcionalidades que não estão aqui. Sugestões são bem-vindas, mas em uma lista separada ao fim de cada fase.
- Se alguma regra deste documento parecer errada ou arriscada, diga isso antes de implementar.
