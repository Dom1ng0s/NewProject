# Plano do projeto

## Visão
Webapp local-first para estudantes e jovens adultos organizarem estudos, finanças e treino. Registrar qualquer coisa leva segundos e o retorno visual é imediato. Uso individual, offline, sem conta, pt-BR. Especificação completa: `docs/ESPECIFICACAO.md`.

## Fases e funcionalidades
Status: a fazer · especificando · aguardando usuário · em implementação · em teste · em revisão · pronto
As fases seguem em sequência sem esperar aprovação (decisão D2). O usuário testa manualmente só o produto final.

### Fase 0: fundação
| # | Item | Status |
|---|---|---|
| 0.1 | Proposta de duas stacks e aprovação (bloqueante) | pronto |
| 0.2 | Estrutura de pastas por módulo, lint, formatação, tipos estritos | a fazer |
| 0.3 | CI: lint, tipos, testes e build a cada push | a fazer |
| 0.4 | Testes unitários, e2e e de acessibilidade rodando (um de cada) | a fazer |
| 0.5 | Persistência, repositórios, schema versionado e migrações testadas | a fazer |
| 0.6 | Exportar/importar JSON, CSV por módulo, apagar tudo | a fazer |
| 0.7 | PWA instalável e offline (casca vazia) | a fazer |
| 0.9 | Deploy automático HTTPS a cada push na `main`. Requer ação do usuário: conectar o repositório à hospedagem (o orquestrador envia o passo a passo com comando de build e pasta de saída) | a fazer |
| 0.10 | Tela de configurações: metas semanais de foco e treino, orçamento mensal, unidades (kg/lb), tema | a fazer |
| 0.11 | Tela Hoje básica: layout com espaços para os cartões de cada pilar e botão de registro rápido | a fazer |
| 0.12 | Registro de ações (histórico com data) que servirá de base para o XP (ver D5) | a fazer |
| 0.13 | Prints automáticos das telas principais em iPhone emulado, gerados pela suíte e2e (ver D6) | a fazer |
| 0.8 | README, CHANGELOG, ADR 0001 (stack) | a fazer |

### Fase 1: Treino
| # | Item | Status |
|---|---|---|
| 1.1 | Biblioteca de exercícios (grupos primário/secundários) | a fazer |
| 1.2 | Fichas prontas e personalizadas, faixa de reps e incremento | a fazer |
| 1.3 | Treino em andamento: séries, "última sessão", repetir com 1 toque, retomar após fechar | a fazer |
| 1.4 | Timer de descanso automático (alerta ao voltar para o app; ver D1) | a fazer |
| 1.5 | Regras 7.5 (sugestão de carga) e 7.6 (1RM) | a fazer |
| 1.6 | Log de cardio manual + regra 7.9 (pace) | a fazer |
| 1.7 | Importação GPX/FIT sem coordenadas por padrão | a fazer |
| 1.8 | Mapa muscular: regras 7.7 e 7.8, acessível | a fazer |
| 1.9 | Recordes pessoais e sequência semanal | a fazer |
| 1.10 | Tela Hoje: cartão do treino previsto ou descanso, atalho de série | a fazer |

### Fase 2: Foco e Prazos
| # | Item | Status |
|---|---|---|
| 2.1 | Matérias/projetos | a fazer |
| 2.2 | Radar de Foco: Pomodoro/livre, avaliação, timer por horário de início | a fazer |
| 2.3 | Heatmap anual e totais semanais por matéria | a fazer |
| 2.4 | Prazos com horas estimadas e progresso (sugestão a partir das sessões) | a fazer |
| 2.5 | Regra 7.2 (risco de prazo) | a fazer |
| 2.6 | Tela Hoje: botão de iniciar foco, prazo mais urgente, atalho de sessão | a fazer |

### Fase 3: Flashcards
| # | Item | Status |
|---|---|---|
| 3.1 | Cards, tópicos e matérias | a fazer |
| 3.2 | Revisão com FSRS (biblioteca aberta), 4 botões, fila do dia | a fazer |
| 3.3 | Regra 7.1 (saúde do tópico) | a fazer |
| 3.4 | Importação Anki por texto exportado | a fazer |
| 3.5 | Importação `.apkg` (secundária, ver pendência 7) | a fazer |
| 3.6 | Tela Hoje: contador de cards para revisar | a fazer |

### Fase 4: Finanças
| # | Item | Status |
|---|---|---|
| 4.1 | Gastos em 3 toques, categorias editáveis, entradas opcionais | a fazer |
| 4.2 | Orçamento mensal + regra 7.3 (disponível hoje) | a fazer |
| 4.3 | Assinaturas: totais, "usei hoje", custo por uso, cobrança automática | a fazer |
| 4.4 | Aviso de renovação dentro do app: faixa na tela Hoje e selo no ícone quando suportado (ver D1) | a fazer |
| 4.5 | Cofrinhos + regra 7.4 (projeção) | a fazer |
| 4.6 | Tela Hoje: disponível para hoje, aviso de renovação, atalho de gasto | a fazer |

### Fase 5: Núcleo e polimento
| # | Item | Status |
|---|---|---|
| 5.1 | Polimento da tela Hoje: sem rolagem excessiva, interativa em menos de 2 s | a fazer |
| 5.2 | Gamificação leve: XP e níveis por pilar calculados do histórico (ver D5) | a fazer |
| 5.3 | Onboarding guiado no primeiro uso, preenchendo as configurações de 0.10 | a fazer |
| 5.4 | Backup automático local com últimas N cópias | a fazer |
| 5.5 | Auditoria de acessibilidade e desempenho (Hoje < 2 s) | a fazer |
| 5.6 | Política de privacidade | a fazer |
| 5.7 | Tela ou aviso incentivando exportar backup periodicamente | a fazer |
| 5.8 | Entrega final: link de produção, guia de instalação no iPhone e roteiro de teste manual | a fazer |

## Riscos técnicos
Levantados na leitura da especificação. O arquiteto deve confirmar cada um na proposta de stack, porque o estado das APIs de navegador muda.

1. **Notificação local sem servidor (6.2 Assinaturas).** Pelo que se sabe hoje, um PWA não consegue agendar uma notificação para disparar com o app fechado de forma confiável, principalmente no iPhone. Web Push exige servidor.
2. **Timers com tela bloqueada (descanso e Pomodoro).** O cálculo pelo horário de início resolve o valor exibido, mas o alerta sonoro ou vibração no fim do descanso provavelmente não dispara com o PWA em segundo plano.
3. **Dados apagados pelo sistema.** Navegadores podem limpar o armazenamento de sites (o Safari é agressivo com sites não instalados). Um backup automático guardado no mesmo armazenamento some junto. Afeta o princípio 3 e o requisito de resiliência.
4. **Importação `.apkg`.** É um SQLite zipado; ler no dispositivo exige SQLite em WebAssembly, o que pesa no bundle.

Tratamento decidido em D1: riscos 1 e 2 viram avisos dentro do app; risco 3 é mitigado com armazenamento persistente (`navigator.storage.persist()`), PWA instalado e incentivo a exportar backup.

## Pendências e dúvidas

### Bloqueantes
Nenhuma no momento. A aprovação da stack (item 0.1) chega na Fase 0.

### Não bloqueantes (suposições que serão seguidas se não houver resposta)
2. 7.3: uma assinatura cobrada vira gasto; `assinaturasAVencerNoMes` inclui só as cobranças ainda não geradas no mês, para não descontar duas vezes.
3. 7.2: "menos de 7 dias de histórico" significa menos de 7 dias desde a primeira sessão de foco. Sessões `dispersa` contam na capacidade, porque o tempo foi gasto.
4. Assinaturas com várias cobranças atrasadas (app sem abrir por meses): gerar todos os lançamentos retroativos, cada um na sua data.
5. "3 interações" no gasto: abrir o lançamento, digitar o valor, tocar na categoria (que salva). Digitar o valor conta como uma interação.
6. Sugestão de carga com redução de 10%: arredondar para baixo, para o múltiplo do incremento mais próximo.
7. `.apkg` fica como último item da Fase 3, só se o custo no bundle for aceitável; texto exportado entra antes.
8. Nome do app: continua `[NOME DO APP]` até você definir.
9. Nome do app segue como placeholder `[NOME DO APP]`, centralizado no arquivo de tradução pt-BR, para trocar depois sem mexer em nenhuma tela.
10. Teste de service worker/offline no Playwright: validado em Chromium (mais confiável para essa checagem); WebKit/iPhone fica para layout, interação, acessibilidade e os prints de D6.

## Decisões
<!-- AAAA-MM-DD | decisão | motivo | ADR (se houver) -->
- **D1** | 2026-09-21 | **PWA puro**, sem empacotar como app nativo. Sem Capacitor, sem App Store. | O usuário não tem Mac nem Android; build iOS nativo exige macOS. PWA instala pelo Safari sem expirar. Aviso de assinatura e fim de descanso ficam dentro do app. O código não deve impedir um empacotamento futuro. | ADR 0001 (a escrever na Fase 0)
- **D2** | 2026-09-21 | **O usuário testa só o produto final.** As fases não param para aprovação; o orquestrador envia um relatório curto no fim de cada fase e segue. Perguntas bloqueantes continuam parando o trabalho. Substitui o "pare e aguarde revisão" da seção 10 da especificação. | Pedido do usuário.
- **D3** | 2026-09-21 | **Testes automatizados substituem o teste manual durante o desenvolvimento.** Todo e2e roda em WebKit com emulação de iPhone e em Chromium com emulação de Android. | Sem teste manual até o fim, os problemas de iPhone precisam aparecer nos testes.
- **D4** | 2026-09-21 | **Configurações e tela Hoje nascem na Fase 0.** Cada fase adiciona à Hoje o seu cartão e o seu atalho; a regra dos 3 toques é testada a partir da Hoje desde a Fase 1. | As fases 1, 2 e 4 dependem de unidades, metas e orçamento; a Hoje é o centro do produto.
- **D5** | 2026-09-21 | **XP é derivado do histórico**, por função pura, sem contadores gravados. | Gamificação entra na Fase 5 sem alterar os pilares e sobrevive a exportar/importar backup.
- **D6** | 2026-09-21 | **Relatório de fase vai com prints** das telas principais em iPhone emulado, mais o link de pré-visualização. | O usuário acompanha visualmente sem testar.
- **D7** | 2026-09-21 | **Revisor em dois níveis:** `revisor` (Sonnet) para itens comuns e `revisor-critico` (Opus) para regras da seção 7, schema e migrações, persistência, backup e privacidade. | Economia de uso sem perder rigor onde erro custa caro.
- **D8** | 2026-09-21 | **Permissões para trabalho autônomo:** edições e comandos do dia a dia liberados; push só para `origin main`; bloqueados push forçado, `reset --hard`, `rm -rf`, `sudo` e leitura de `.env`. | Evitar que a sessão pare a cada comando.
- **D9** | 2026-09-21 | **Stack (item 0.1): React 19 + TypeScript strict + Vite + Dexie 4 (IndexedDB)**, `dexie-react-hooks`, Zustand para estado efêmero, `vite-plugin-pwa`, Playwright (WebKit/iPhone + Chromium/Android) + `@axe-core/playwright`, Vitest, ESLint 9 + Prettier, `ts-fsrs`, GitHub Actions. `.apkg` (Fase 3) usa `sql.js` carregado sob demanda só na tela de importação. `dexie-cloud-addon` não será instalado. | Menor risco de plataforma no Safari/iPhone (IndexedDB funciona em qualquer contexto, inclusive aba privada) e menor número de peças para manter num app de um usuário só. Resposta do usuário à proposta do arquiteto. | ADR 0001
- **D10** | 2026-09-21 | **Hospedagem (item 0.9): Cloudflare Pages**, repositório GitHub conectado, build Vite, saída `dist/`, preview automático por branch/PR. | Preview por branch atende aos relatórios de fase (D6); sem analytics injetado por padrão (princípio 4). Resposta do usuário. | ADR 0001

## Sugestões fora do escopo
<!-- Ideias que surgirem durante as fases, para avaliar depois -->
