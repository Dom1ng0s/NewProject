# Plano do projeto

## Visão
Webapp local-first para estudantes e jovens adultos organizarem estudos, finanças e treino. Registrar qualquer coisa leva segundos e o retorno visual é imediato. Uso individual, offline, sem conta, pt-BR. Especificação completa: `docs/ESPECIFICACAO.md`.

## Fases e funcionalidades
Status: **a fazer** · **em andamento** · **aguardando usuário** · **pronto**.
As fases seguem em sequência sem esperar aprovação (D2). O usuário testa manualmente só o produto final.

### Fase 0: fundação
| # | Item | Status |
|---|---|---|
| 0.1 | Proposta de duas stacks e aprovação (bloqueante) | pronto |
| 0.2 | Estrutura de pastas por módulo, lint, formatação, tipos estritos | pronto |
| 0.3 | CI: lint, tipos, testes e build a cada push | pronto |
| 0.4 | Testes unitários, e2e e de acessibilidade rodando (um de cada) | pronto |
| 0.5 | Persistência, repositórios, schema versionado e migrações testadas | pronto |
| 0.6 | Exportar/importar JSON, CSV por módulo, apagar tudo | pronto |
| 0.7 | PWA instalável e offline (casca vazia) | pronto |
| 0.10 | Tela de configurações: metas semanais de foco e treino, orçamento mensal, unidades (kg/lb), tema | pronto |
| 0.11 | Tela Hoje básica: layout com espaços para os cartões de cada pilar e botão de registro rápido | pronto |
| 0.12 | Registro de ações (histórico com data), base do XP (ver D5) | pronto |
| 0.13 | Prints automáticos das telas principais em iPhone emulado (ver D6) | pronto |
| 0.8 | README, CHANGELOG, ADR 0001 (stack) | pronto |
| 0.9 | Deploy HTTPS automático a cada push na `main`. **Depende do usuário** conectar o repositório ao Cloudflare Pages; o passo a passo já pode ser enviado | aguardando usuário |

### Fase 1: Finanças
| # | Item | Status |
|---|---|---|
| 1.1 | Gastos em 3 toques, categorias editáveis, entradas opcionais | pronto |
| 1.2 | Orçamento mensal + regra 7.3 (disponível hoje) | pronto |
| 1.3 | Assinaturas: totais, "usei hoje", custo por uso, cobrança automática | a fazer |
| 1.4 | Aviso de renovação dentro do app: faixa na tela Hoje e selo no ícone quando suportado (ver D1) | a fazer |
| 1.5 | Cofrinhos + regra 7.4 (projeção) | a fazer |
| 1.6 | Tela Hoje: disponível para hoje, aviso de renovação, atalho de gasto | em andamento |

### Fase 2: Foco e Prazos
| # | Item | Status |
|---|---|---|
| 2.1 | Matérias/projetos | a fazer |
| 2.2 | Radar de Foco: Pomodoro/livre, avaliação, timer por horário de início | a fazer |
| 2.3 | Heatmap anual e totais semanais por matéria | a fazer |
| 2.4 | Prazos com horas estimadas e progresso (sugestão a partir das sessões) | a fazer |
| 2.5 | Regra 7.2 (risco de prazo) | a fazer |
| 2.6 | Tela Hoje: botão de iniciar foco, prazo mais urgente, atalho de sessão | a fazer |

### Fase 3: Treino
| # | Item | Status |
|---|---|---|
| 3.1 | Biblioteca de exercícios (grupos primário/secundários) | a fazer |
| 3.2 | Fichas prontas e personalizadas, faixa de reps e incremento | a fazer |
| 3.3 | Treino em andamento: séries, "última sessão", repetir com 1 toque, retomar após fechar | a fazer |
| 3.4 | Timer de descanso automático (alerta ao voltar para o app; ver D1) | a fazer |
| 3.5 | Regras 7.5 (sugestão de carga) e 7.6 (1RM) | a fazer |
| 3.6 | Log de cardio manual + regra 7.9 (pace) | a fazer |
| 3.7 | Mapa muscular: regras 7.7 e 7.8, acessível | a fazer |
| 3.8 | Recordes pessoais e sequência semanal | a fazer |
| 3.9 | Tela Hoje: cartão do treino previsto ou descanso, atalho de série | a fazer |

### Fase 4: Flashcards
| # | Item | Status |
|---|---|---|
| 4.1 | Cards, tópicos e matérias | a fazer |
| 4.2 | Revisão com FSRS (`ts-fsrs`), 4 botões, fila do dia | a fazer |
| 4.3 | Regra 7.1 (saúde do tópico) | a fazer |
| 4.4 | Importação Anki por texto exportado | a fazer |
| 4.5 | Tela Hoje: contador de cards para revisar | a fazer |

### Fase 5: Núcleo e polimento
| # | Item | Status |
|---|---|---|
| 5.1 | Polimento da tela Hoje: sem rolagem excessiva, interativa em menos de 2 s | a fazer |
| 5.2 | Gamificação leve: XP e níveis por pilar calculados do histórico (ver D5) | a fazer |
| 5.3 | Onboarding guiado no primeiro uso, preenchendo as configurações de 0.10 | a fazer |
| 5.4 | Auditoria de acessibilidade e desempenho (Hoje < 2 s) | a fazer |
| 5.5 | Política de privacidade | a fazer |
| 5.6 | Tela ou aviso incentivando exportar backup periodicamente | a fazer |
| 5.7 | Entrega final: link de produção, guia de instalação no iPhone e roteiro de teste manual | a fazer |

### Fase 6: opcional (só se houver vontade depois do 5.7)
Adiados por decisão D14: custo alto e uso improvável num app de uma pessoa. Não bloqueiam a entrega.

| # | Item | Status |
|---|---|---|
| 6.1 | Importação GPX/FIT sem coordenadas por padrão (era 1.7) | adiado |
| 6.2 | Importação Anki `.apkg` via `sql.js` (era 3.5) | adiado |
| 6.3 | Backup automático local com últimas N cópias (era 5.4) | adiado |

## Riscos técnicos
Tratamento decidido em D1: riscos 1 e 2 viram avisos dentro do app; risco 3 é mitigado com armazenamento persistente (`navigator.storage.persist()`), PWA instalado e incentivo a exportar backup.

1. **Notificação local sem servidor (6.2 Assinaturas).** Um PWA não agenda notificação com o app fechado de forma confiável, principalmente no iPhone. Web Push exige servidor.
2. **Timers com tela bloqueada (descanso e Pomodoro).** O valor exibido é calculado pelo horário de início, mas o som/vibração no fim do descanso provavelmente não dispara em segundo plano.
3. **Dados apagados pelo sistema.** O Safari é agressivo com sites não instalados; um backup automático guardado no mesmo armazenamento some junto. Afeta o princípio 3.
4. **Importação `.apkg`.** SQLite zipado; ler no dispositivo exige SQLite em WebAssembly, que pesa no bundle.

## Pendências abertas
Números preservados de propósito: comentários no código e ADRs citam "pendência N". Entradas já resolvidas em código foram removidas (o histórico está no git e nos ADRs).

### Ação do usuário
13. Proteção de branch na `main` (status check obrigatório) não foi ativada — para não travar push direto (D8) enquanto não há fluxo de PR. Não bloqueante.

### Regras e produto (decidem trabalho futuro)
2. 7.3: uma assinatura cobrada vira gasto; `assinaturasAVencerNoMes` inclui só as cobranças ainda não geradas no mês, para não descontar duas vezes.
3. 7.2: "menos de 7 dias de histórico" = menos de 7 dias desde a primeira sessão de foco. Sessões `dispersa` contam na capacidade, porque o tempo foi gasto.
4. Assinaturas com várias cobranças atrasadas (app sem abrir por meses): gerar todos os lançamentos retroativos, cada um na sua data.
5. "3 interações" no gasto: abrir o lançamento, digitar o valor, tocar na categoria (que salva). Categoria é obrigatória também em entradas (1.1).
6. Sugestão de carga com redução de 10%: arredondar para baixo, para o múltiplo do incremento mais próximo.
7. `.apkg` foi adiado para a Fase 6 (D14); a importação por texto exportado (4.4) cobre o caso.
9. Nome do app segue como placeholder `[NOME DO APP]`, centralizado no i18n pt-BR. `short_name` separado só se o nome real passar de 12 caracteres (limite do iPhone).
22. Orçamento mensal é valor único (alterá-lo muda o cálculo de meses passados); orçamento por mês fica para a Fase 4 se necessário.
56. Meta de foco/treinos zero significa "sem meta" — a Fase 2 precisa tratar a divisão por zero na regra 7.2 (`metaSemanal / 7` como capacidade).
37. `tipo` de ação desconhecido é aceito na importação (backup de build mais novo). O XP do item 5.2 precisa de caso padrão com peso 0.
34. Exportar, importar e apagar tudo não registram ação no histórico. A fonte de dado do aviso periódico de backup (item 5.6) é decidida naquele item.

### Convenções que valem para toda entrega nova
20. Exclusão é sempre soft delete (`deletedAt`), sai no backup marcada; sem purga automática.
23. Grandeza com fração vira inteiro na menor unidade (peso em gramas, distância em metros); `unidadeDePeso` é só exibição.
24. Índices compostos e índice em `referenciaId` do histórico ficam para a fase que precisar.
33. Backup de `versaoDoSchema` diferente da atual é bloqueado, não convertido. **Quem criar a migração `vN+1` implementa a conversão do backup `vN` no mesmo commit** — o `revisor` cobra isso a partir da Fase 1. O backup de exemplo dos prints também acompanha cada migração.
67. `@testing-library/react` não será instalada. Regra em função pura (Vitest), marcação em `renderToStaticMarkup`, comportamento real no e2e.
68. Regras `best-practice` do axe estão no portão de acessibilidade de todas as telas. Exceção só individual, com motivo registrado aqui.
69. Cada tela tem título de página próprio (`Tela · [NOME DO APP]`; a Hoje usa só o nome do app). Rota desconhecida redireciona para a Hoje.
71. Contrato `CartaoDeHoje`: o módulo entrega só o conteúdo (a Hoje desenha `<section>`+`<h2>`). Cada fase segue as 8 regras da seção 3.3 do ADR 0009 e **troca** o placeholder do seu pilar, não soma.
10. Offline, instalabilidade e cache do service worker só são verificáveis no Chromium. Esses blocos levam `@chromium` no título: o projeto `android-chromium` roda só eles (6 testes), o WebKit/iPhone roda o resto (D13).
75. Prints da fase: `hoje.png`, `hoje-escuro.png` e uma por tela nova. Banco vazio na Fase 0; da Fase 1 em diante, backup de exemplo importado pela tela Dados (nunca acesso direto ao banco).
76. Prints rodam só por `npm run test:e2e:prints` (`e2e/prints.spec.ts`, excluído de `npm run test:e2e` por `@prints`), só em `iphone-webkit`.

### Tela Hoje (fases 1 a 5 dependem disto)
63. Registro rápido são três atalhos diretos (gasto, série, sessão), um por pilar — nunca um botão único com menu, que custaria um quarto toque no gasto.
64. Navegação com dois destinos (Hoje e Configurações) num cabeçalho simples. As telas dos pilares abrem pelo cartão do pilar na Hoje.
65. Ordem dos cartões: Finanças, Estudos, Treino, Seu progresso. Ajuste fino no item 5.1.
66. Sem data nem saudação na Hoje até o item 3.9 (treino previsto), que é a primeira necessidade real de um "hoje" reativo.
48. Cor de fundo/tema do manifesto fixada em `#ffffff`: a tela de abertura instalada no Android fica branca mesmo no escuro. Revisitar no item 5.1.
72. Linha de base de desempenho: JS de entrada com **126,41 kB gzip**, para o item 5.4 comparar contra "Hoje interativa em menos de 2 s".

## Decisões
<!-- AAAA-MM-DD | decisão | motivo | ADR (se houver) -->
- **D1** | 2026-09-21 | **PWA puro**, sem empacotar como app nativo. Sem Capacitor, sem App Store. | O usuário não tem Mac nem Android; build iOS nativo exige macOS. PWA instala pelo Safari sem expirar. Aviso de assinatura e fim de descanso ficam dentro do app. O código não deve impedir um empacotamento futuro. | ADR 0001 (a escrever na Fase 0)
- **D2** | 2026-09-21 | **O usuário testa só o produto final.** As fases não param para aprovação; o orquestrador envia um relatório curto no fim de cada fase e segue. Perguntas bloqueantes continuam parando o trabalho. Substitui o "pare e aguarde revisão" da seção 10 da especificação. | Pedido do usuário.
- **D3** | 2026-09-21 | **Testes automatizados substituem o teste manual durante o desenvolvimento.** Todo e2e roda em WebKit com emulação de iPhone e em Chromium com emulação de Android. | Sem teste manual até o fim, os problemas de iPhone precisam aparecer nos testes.
- **D4** | 2026-09-21 | **Configurações e tela Hoje nascem na Fase 0.** Cada fase adiciona à Hoje o seu cartão e o seu atalho; a regra dos 3 toques é testada a partir da Hoje desde a Fase 1. | As fases 1, 2 e 4 dependem de unidades, metas e orçamento; a Hoje é o centro do produto.
- **D5** | 2026-09-21 | **XP é derivado do histórico**, por função pura, sem contadores gravados. | Gamificação entra na Fase 5 sem alterar os pilares e sobrevive a exportar/importar backup.
- **D6** | 2026-09-21 | **Relatório de fase vai com prints** das telas principais em iPhone emulado, mais o link de pré-visualização. | O usuário acompanha visualmente sem testar.
- **D7** | 2026-09-21 | **Revisor em dois níveis:** `revisor` (Sonnet) para itens comuns e `revisor-critico` (Opus) para regras da seção 7, schema e migrações, persistência, backup e privacidade. | Economia de uso sem perder rigor onde erro custa caro.
- **D11** | 2026-09-21 | **Configurações padrão antes do onboarding:** metas preenchidas (10h de foco/semana, 3 treinos/semana), peso em kg, tema do sistema; orçamento mensal em branco (`null`) até o usuário definir — a Hoje mostra "defina seu orçamento" em vez de calcular com um valor inventado. | Resposta do usuário à pergunta bloqueante do arquiteto no item 0.5: orçamento não tem um neutro razoável, meta tem. | ADR 0005
- **D12** | 2026-09-21 | **Nome técnico do banco IndexedDB: `app-rotina-db`.** Fixo, não deriva do nome do produto (ainda placeholder). | Resposta do usuário: preferiu o sufixo `-db` explícito a reaproveitar o nome do pacote sem sufixo. | ADR 0005
- **D8** | 2026-09-21 | **Permissões para trabalho autônomo:** edições e comandos do dia a dia liberados; push só para `origin main`; bloqueados push forçado, `reset --hard`, `rm -rf`, `sudo` e leitura de `.env`. | Evitar que a sessão pare a cada comando.
- **D9** | 2026-09-21 | **Stack (item 0.1): React 19 + TypeScript strict + Vite + Dexie 4 (IndexedDB)**, `dexie-react-hooks`, Zustand para estado efêmero, `vite-plugin-pwa`, Playwright (WebKit/iPhone + Chromium/Android) + `@axe-core/playwright`, Vitest, ESLint 9 + Prettier, `ts-fsrs`, GitHub Actions. `.apkg` (Fase 3) usa `sql.js` carregado sob demanda só na tela de importação. `dexie-cloud-addon` não será instalado. | Menor risco de plataforma no Safari/iPhone (IndexedDB funciona em qualquer contexto, inclusive aba privada) e menor número de peças para manter num app de um usuário só. Resposta do usuário à proposta do arquiteto. | ADR 0001
- **D10** | 2026-09-21 | **Hospedagem (item 0.9): Cloudflare Pages**, repositório GitHub conectado, build Vite, saída `dist/`, preview automático por branch/PR. | Preview por branch atende aos relatórios de fase (D6); sem analytics injetado por padrão (princípio 4). Resposta do usuário. | ADR 0001
- **D13** | 2026-09-26 | **Orquestração enxuta.** Seis subagentes viram dois: `dev` (regras + persistência + telas + testes numa chamada só) e `revisor` (só em item de risco: seção 7, schema/migrações, persistência, backup, privacidade, dependência nova). O orquestrador escreve o contrato de cada item em poucas linhas, no lugar do ciclo do `arquiteto`, e pode fazer ajustes pequenos direto. ADR só para decisão cara de desfazer. **Substitui D7** (revisor em dois níveis) e **restringe D3**: e2e roda só em WebKit/iPhone, sem duplicar em Chromium/Android. Nada de tratar concorrência, papéis, limites ou escala — é um app de uma pessoa em um aparelho. | Pedido do usuário: o ciclo de cinco passos por item estava custando tempo e token demais para um app monousuário.
- **D14** | 2026-09-26 | **Ordem das fases: Finanças → Foco → Treino → Flashcards** (antes Treino primeiro), e três itens vão para uma Fase 6 opcional: GPX/FIT, `.apkg` e backup automático local. | Finanças é o pilar mais barato (6 itens) e de uso diário mais óbvio, então o app fica útil antes; Treino, o mais pesado, pega a base já madura. Os três adiados custam caro e resolvem pouco para um usuário só — `.apkg` é coberto pela importação por texto (4.4) e o backup automático mora no mesmo armazenamento que o risco 3 ameaça. Resposta do usuário.
- **D15** | 2026-09-27 | **Fim dos ADRs e da validação de backup por módulo.** Decisão vira uma linha aqui. Teste só em regra da seção 7, migração e um e2e por fluxo de registro. Itens são agrupados em poucas chamadas grandes ao `dev`, não uma por item. | 4.251 linhas de ADR e 6.596 de teste para um app com uma funcionalidade de pé. O custo estava no volume de artefato por item, não no número de agentes (D13 tratou o sintoma errado). Pedido do usuário.

## Sugestões fora do escopo
<!-- Só o que ainda vale a pena. Nitpick de revisão não entra. -->
- `src/app/App.tsx` não trata rejeição de `atualizar()`: se `updateServiceWorker` falhar, o botão "Atualizar agora" fica preso em "Atualizando...". Um `.catch()` com reset do estado resolve.
- `ehDiaDeCalendario` aceita data inexistente como `2026-13-45` (só checa o padrão, não o calendário). Vale validar de verdade antes da Fase 1 trazer datas retroativas vindas de `<input type="date">`.
- `Configuracoes.tsx`: `blur` e `visibilitychange` disparando juntos podem gravar duas ações no histórico para uma única edição. Uma flag de "gravando em andamento" evitaria.
- Item 5.6: mostrar se o armazenamento persistente foi concedido, junto com o aviso de backup.
- Item 5.7 (roteiro manual): conferir no VoiceOver se o aviso de atualização (`role="status"`) é anunciado ao aparecer.
- Convite para instalar dentro do app (`beforeinstallprompt` no Android, instrução de "Adicionar à Tela de Início" no iPhone). Fora da especificação.
