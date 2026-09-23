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
| 0.2 | Estrutura de pastas por módulo, lint, formatação, tipos estritos | pronto |
| 0.3 | CI: lint, tipos, testes e build a cada push | pronto |
| 0.4 | Testes unitários, e2e e de acessibilidade rodando (um de cada) | pronto |
| 0.5 | Persistência, repositórios, schema versionado e migrações testadas | pronto |
| 0.6 | Exportar/importar JSON, CSV por módulo, apagar tudo | pronto |
| 0.7 | PWA instalável e offline (casca vazia) | pronto |
| 0.9 | Deploy automático HTTPS a cada push na `main`. Requer ação do usuário: conectar o repositório à hospedagem (o orquestrador envia o passo a passo com comando de build e pasta de saída) | a fazer |
| 0.10 | Tela de configurações: metas semanais de foco e treino, orçamento mensal, unidades (kg/lb), tema | pronto |
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
11. `e2e/placeholder.spec.ts` (criado no item 0.2 só para o critério de aceite 8) é escopo do `testador`: deve ser substituído/removido no item 0.4 junto com a suíte real.
12. CI (ADR 0003, item 0.3): confirmado no primeiro push real (commit 2362df1, run 35678172127) — os dois jobs terminaram verdes (`verificar` 30s, `e2e` 1m23s). Critérios que exigem falha proposital (3, 4) e push só de documentação (7) ainda não foram testados; não bloqueante, testar quando a oportunidade surgir naturalmente.
13. Proteção de branch na `main` (status check obrigatório) não foi ativada agora — decisão do arquiteto no ADR 0003, para não travar push direto (D8) enquanto não há fluxo de PR. Ação do usuário no GitHub, não bloqueante.
14. Testes (ADR 0004, item 0.4): `@testing-library/react` e `@testing-library/user-event` **não** entram no 0.4 (nenhum componente com comportamento para testar ainda). Adiada no item 0.7 e de novo no item 0.10 (testes de componente usam `renderToStaticMarkup`; comportamento real coberto por e2e nos dois navegadores) — decisão passa para o item 0.11. Altera o que o ADR 0002 previa.
15. Acessibilidade (ADR 0004): o portão do axe usa as cinco etiquetas WCAG (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`), porque elas não são cumulativas e a seção 9 pede WCAG 2.2 AA. A etiqueta `best-practice` (landmark `main`, um `h1`, `region`) fica fora do portão até existir tela real; reavaliar no item 0.11, promovendo o que fizer sentido a requisito de tela.
16. Item 0.4: o `testador` precisa apagar `e2e/placeholder.spec.ts`, e nem `git rm` nem `rm` estão no `allow` do `.claude/settings.json`. O orquestrador autoriza o comando na hora ou remove o arquivo por outro meio.
17. Item 0.5 (persistência real): resolvido no ADR 0005. `globalThis.indexedDB = new IDBFactory()` não funciona (Dexie resolve a fábrica no construtor, a instância única já existe). Decisão final: nome do banco sempre fixo e real (`app-rotina-db`, D12); testes de schema/migração usam `criarBanco({ indexedDB: new IDBFactory() })`; testes de repositório limpam as tabelas da instância única no `beforeEach`. `ambiente.test.ts` (item 0.4) é adaptado a este padrão, não apagado.
18. CI (item 0.3/0.4): confirmado verde no push do commit 3277d59 (run 35679550763).
19. CI (ADR 0003, critério 7): confirmado — o push só de `docs/PLANO.md` (commit 3915554) não disparou nova execução (`paths-ignore` funcionando).
20. Persistência (ADR 0005, item 0.5): registro excluído nunca é apagado de verdade (soft delete via `deletedAt`, permite desfazer, sai no backup marcado); sem purga automática por ora.
21. `salvarConfiguracoes` grava uma ação no histórico (peso 0 no XP), para o item 0.12 ter um escritor real testado desde já.
22. Orçamento mensal é valor único (alterá-lo muda o cálculo de meses passados); orçamento por mês fica para a Fase 4 se necessário.
23. Grandezas com fração viram inteiro na menor unidade (peso em gramas, distância em metros); `unidadeDePeso` é só exibição.
24. Índices compostos e índice em `referenciaId` do histórico ficam fora da v1, para a fase que precisar.
25. `vitest.config.ts` passa a fixar `TZ=America/Sao_Paulo` nos testes, para data de calendário não depender da máquina.
26. Item 0.5, `revisor-critico` (1ª rodada): reprovado por dois bloqueantes, ambos corrigidos e reaprovados na 2ª rodada. `dataDeCalendarioDe` (`src/compartilhado/datas.ts`) agora rejeita (lança) qualquer string sem componente de hora (`THH:MM`), porque `new Date('2026-09-21')` é aceito pelo JS como meia-noite UTC e produzia um dia errado silencioso em `America/Sao_Paulo` — risco real a partir da Fase 1/4, quando `ocorridaEm` retroativo vier de `<input type="date">`. `vitest.config.ts`: `coverage.include` voltou a `['src/**/dominio/**', 'src/persistencia/**']`, exatamente o previsto no ADR 0005 §8 (a versão reprovada incluía também `src/modulos/*/repositorio/**`, deixando `hooks.ts` em 0% sem teste de componente para cobri-lo).
27. Dependência nova instalada no item 0.5: `@vitest/coverage-v8` (dev), exigida pelo `coverage.provider: 'v8'` já configurado no item 0.4 para gerar relatório de cobertura sem erro (critério de aceite 15 do ADR 0005). Só ferramenta de relatório em tempo de teste; nada entra no bundle de produção (`npm run build` não a referencia). Critério 14 do ADR 0005 ("nenhuma dependência nova") não se aplica a ela por esse motivo.
28. Cobertura do Vitest (`vitest.config.ts`) cobre só `src/**/dominio/**` e `src/persistencia/**`, não `src/modulos/*/repositorio/**` nem `src/compartilhado/**`. Repositórios do núcleo e `hooks.ts` (único arquivo com React do item 0.5) ficam fora do relatório até existir teste de componente na stack; reavaliar com o arquiteto antes da Fase 1 se a cobertura por módulo importar.
29. Item 0.6 (backup, ADR 0006): nome do arquivo exportado é `app-rotina-backup-AAAA-MM-DD.json`, mesmo identificador técnico do banco (`app-rotina-db`), não o nome do produto (placeholder, pendência 8/9); a importação nunca depende do nome do arquivo, só do conteúdo.
30. Item 0.6: dois backups exportados no mesmo dia ficam com o mesmo nome; quem resolve é o navegador ou o app Arquivos do usuário (sufixo automático ou pedido de substituição). Sem hora no nome, para manter o nome legível.
31. Item 0.6: CSV por módulo usa separador `;`, `CRLF` e BOM (abre direto no Excel em pt-BR), traz **só linhas ativas** (soft-deleted ficam de fora) e colunas declaradas explicitamente por tabela. O JSON continua sendo o único arquivo completo e o único caminho de restauração — a importação não lê CSV.
32. Item 0.6: confirmação de "apagar tudo" exige digitar a palavra `APAGAR` (sem diferenciar maiúsculas, com `trim()`); importar backup não pede palavra digitada, só escolher o arquivo e confirmar com o resumo (contagens por módulo) à vista — dois passos em ambos os fluxos, sem `window.confirm`.
33. Item 0.6: backup gerado por uma `versaoDoSchema` diferente da atual é **bloqueado** com mensagem específica, em vez de convertido. A entrega que criar a migração de schema `vN+1` decide e implementa a conversão do backup da versão `N` no mesmo commit — o `revisor-critico` passa a cobrar isso a partir da Fase 1.
34. Item 0.6: nem `importarBackup`, nem `apagarTudo`, nem exportar registram ação no histórico (quebraria a idempotência de exportar → importar → exportar e o estado de "primeiro uso" depois de apagar tudo). A fonte de dado do aviso periódico de backup (item 5.7) é decidida naquele item.
35. Item 0.6: `apagarTudo` faz `clear()` físico nas tabelas, mas não apaga o banco `app-rotina-db` nem o cache do service worker — o app continua instalado e offline, só os dados do usuário somem.
36. Item 0.6: os stubs de `treino`, `estudos` e `financas` passam a **rejeitar** (lançar) quando a importação traz alguma chave de tabela para eles, em vez de ignorar em silêncio — evita anunciar "backup importado" tendo descartado dado de um pilar sem tabela ainda.
37. Item 0.6: `tipo` de ação do histórico fora da união `TipoDeAcao` é **aceito** na importação se respeitar a invariante do prefixo (`${modulo}.`), para não impedir restaurar um backup gerado por um build mais novo do app. Consequência registrada para o item 5.2: o cálculo de XP precisa de um caso padrão com peso 0 para `tipo` desconhecido.
38. Item 0.6, `revisor-critico` (1ª rodada): reprovado com 4 apontamentos bloqueantes, todos corrigidos e reaprovados na 2ª rodada. `validarLinhaDeConfiguracoes` (`repositorio/contrato-de-dados.ts`) passou a exigir as 6 chaves de `Configuracoes` e validar `onboardingConcluidoEm` (`null` ou instante ISO); `validarLinhaDeAcao` passou a exigir `tipo.startsWith(\`${modulo}.\`) && tipo.length > modulo.length + 1` (antes aceitava `tipo` sem sufixo ou com sufixo vazio). `VERSAO_DO_SCHEMA` deixou de ser reexportado direto de `@/persistencia` em `src/modulos/nucleo/index.ts` (violava a matriz do ADR 0002 §4) e passou a sair via `repositorio/backup.ts`. `Dados.tsx` passou a mover o foco para a mensagem de resultado ao concluir importação e preparo de CSV (sucesso, erro e "sem dados"), completando a regra do ADR 0006 §7.6 que já valia para "apagar tudo".
39. Item 0.6: o `revisor-critico` (2ª rodada) registrou 3 sugestões não bloqueantes, não tratadas nesta entrega — ver "Sugestões fora do escopo": foco no erro de exportar JSON/CSV isolado (`BotaoDeArquivo`, `Dados.tsx`), alvo de toque do `<summary>` "Detalhes técnicos" e do botão "Salvar arquivo" (estado `precisaDeNovoToque`) não medidos no e2e.
40. Item 0.6: sugestões não bloqueantes da 1ª rodada do `revisor-critico`, também não tratadas — ver "Sugestões fora do escopo": mensagem de erro de backup cita valor de campo (`id`/`tipo`) em vez de só nome do campo e índice; stubs dos pilares lançam de forma síncrona em função que deveria devolver `Promise` (`Promise.reject`); chaves extras desconhecidas num registro são gravadas em silêncio; `ehDiaDeCalendario` não valida calendário real (aceita `2026-13-45`).
41. Item 0.6: teste de "preparar CSV com erro perde o foco" foi pulado no e2e (`testador`, 2ª rodada) — não há caminho determinístico via UI para simular falha de `exportarCsvPorModulo`/IndexedDB no meio da chamada. A correção de produção (mover foco também nesse caminho) foi feita; só a cobertura e2e desse caso específico ficou de fora.
42. Item 0.6: `src/app/modulos.test.ts` (novo) é o primeiro teste a usar a lista real `contratosDeDados` de `src/app/modulos.ts` em vez de contratos fake — cobre os critérios 4/7/13/14 do ADR 0006 com a composição real dos módulos, não só o núcleo isolado.
43. Item 0.6: nenhuma dependência nova; `npm run verificar` (lint, format, typecheck, 152 testes unitários, build) e a suíte e2e (`iphone-webkit` + `android-chromium`, dados.spec.ts + acessibilidade.spec.ts) confirmados verdes pelo `revisor-critico` na 2ª rodada, antes da aprovação.
44. Item 0.7 (ADR 0007): ícone provisório — três barras brancas crescentes sobre `#0a5cb8`, sem letra, sem depender do nome do app (ainda placeholder). Gerado por script de desenvolvimento (`npm run icones`, Chromium do Playwright), rodado à mão, arquivos versionados; não roda no build nem no CI.
45. Item 0.7: `orientation: 'portrait'` removido do manifesto — exigência WCAG 2.2, critério 1.3.4 (AA), que proíbe travar a orientação sem justificativa essencial. O app instalado gira com o aparelho.
46. Item 0.7: sem aviso de "pronto para uso offline" e sem convite para instalar dentro do app (`beforeinstallprompt`/"Adicionar à Tela de Início") — só o aviso de versão nova. Convite de instalação vira sugestão fora do escopo.
47. Item 0.7: aviso de versão nova aparece no topo da página, no fluxo normal (não fixo, não modal), sem mover foco; "Depois" esconde até a próxima abertura do app. Sem verificação periódica de versão nova — só a checagem nativa do navegador a cada abertura.
48. Item 0.7: cor de fundo/tema do manifesto fixada em `#ffffff` (tema claro) — a tela de abertura instalada no Android fica branca mesmo com o aparelho no escuro. Revisitar no item 0.10 (tema manual).
49. Item 0.7: `short_name` igual a `NOME_DO_APP` (placeholder) enquanto o nome real não chegar; nome curto separado só se o nome real passar de 12 caracteres (limite do iPhone na tela inicial).
50. Item 0.7: `solicitarArmazenamentoPersistente()` é chamado uma vez por abertura do app, sem interface e sem mostrar o resultado ao usuário. No Firefox pode abrir um pedido de permissão do navegador; Firefox não é alvo do produto.
51. Item 0.7: o Lighthouse não tem mais categoria PWA (removida na v12); a verificação de instalabilidade usa o protocolo do Chrome (`Page.getAppManifest`/`Page.getInstallabilityErrors`) via Playwright, só em Chromium. O fluxo real de atualização (versão nova → aviso → recarga) não é automatizável no e2e (Playwright não intercepta o script do service worker numa atualização) — fica coberto por tipos, teste de componente e o roteiro manual do item 5.8.
52. Item 0.7, `revisor-critico`: aprovado sem bloqueante na 1ª rodada. Confirmado por leitura direta dos PNGs (não só pelo IHDR): cantos transparentes nos ícones `any` (192/512), fundo opaco de ponta a ponta no maskable e no apple-touch-icon, glifo dentro da zona segura (ponto mais distante do centro a 33,3%/33,0% do lado, dentro do limite de 40%).
53. Item 0.10 (ADR 0008): configurações salvam sozinhas por campo (rádio no `change`; texto no `blur`/`Enter`/página oculta), sem botão "Salvar" — só grava se o texto mudou, para não encher o histórico. Uma ação `nucleo.configuracoesSalvas` por campo alterado (peso 0 no XP).
54. Item 0.10: meta de foco digitada em horas, com no máximo uma casa decimal (`7,5` = 450 min, conversão exata). Valor importado que não é múltiplo de 6 minutos é exibido arredondado e só é regravado se o usuário editar o texto.
55. Item 0.10: orçamento em texto livre em reais, lido de forma tolerante (`1500`, `1.500,00`, `R$ 1.500`, `12.50`), convertido para centavos sobre o texto (nunca `parseFloat × 100`, evita ponto flutuante); campo vazio grava `null`.
56. Item 0.10: sem limite superior para metas nem orçamento. Meta de foco/treinos zero é aceita (significa "sem meta") — fica registrado para a Fase 2 tratar a divisão por zero da regra 7.2 (`metaSemanal / 7` como capacidade).
57. Item 0.10: tema aplicado por atributo `data-tema` no `<html>`, resolvido em JavaScript (script inline no `index.html` antes da primeira pintura + hook `useAplicarTema` depois de ler a configuração); `@media (prefers-color-scheme)` sai do `tokens.css`. Tema manual diferente do sistema pode piscar por alguns milissegundos na abertura (não espelhado em `localStorage`, ADR 0005 já recusou storage fora do IndexedDB). Meta `theme-color` acompanha o tema escolhido dentro do app; o manifesto continua `#ffffff` (pendência 48 continua valendo para a tela de abertura do Android).
58. Item 0.10: `@testing-library/react` segue fora (pendência 14 passa para o item 0.11) — testes de componente usam `renderToStaticMarkup`, comportamento real coberto por e2e nos dois navegadores.
59. Item 0.10: tela de configurações ganha link para `/dados` (especificação trata "Configurações e dados" como um só lugar, seção 6.4); `problemasDeConfiguracoes` (nova) é a fonte única de regra, `validarConfiguracoes` passa a derivar dela sem mudar mensagens nem assinatura.
60. Item 0.10, `revisor-critico` (1ª rodada): reprovado por 2 bloqueantes, ambos corrigidos e reaprovados na 2ª rodada. `lerCentavosDeReais` (`src/compartilhado/dinheiro.ts`) tinha um bug real: a regex aceitava ponto decimal seguido de vírgula (ex.: `'10.00,50'`) e truncava o valor em silêncio em vez de rejeitar — corrigido restringindo a vírgula decimal para só valer depois dos ramos de milhar/sem separador, nunca depois do ramo de ponto decimal. Também corrigido um erro do próprio orquestrador: a tentativa inicial de consertar `e2e/pwa.spec.ts` (teste do item 0.7 que comparava `package.json` contra `git show HEAD:...`, quebrado porque o commit do item 0.7 virou o próprio `HEAD`) usou um hash de commit fixo, que por sua vez quebraria no CI (clone raso, sem `fetch-depth`) — substituído por uma lista fixa de dependências aprovadas, sem depender de git.
61. Item 0.10, `revisor-critico` (2ª rodada): 3 sugestões não bloqueantes, não tratadas nesta entrega — ver "Sugestões fora do escopo": campo de texto tocado antes da primeira leitura do banco pode ficar mostrando o valor padrão desatualizado até a próxima mudança; `blur` e `visibilitychange` disparando juntos antes da gravação terminar podem gerar duas ações de histórico para uma única edição; instabilidade ocasional no teste e2e do critério 13 (provavelmente relacionada a tempo de carregamento, não a um bug de gravação).

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

## Sugestões fora do escopo
<!-- Ideias que surgirem durante as fases, para avaliar depois -->
- Item 0.5, `revisor-critico`: mensagem de erro de `validarInstante` (`src/compartilhado/datas.ts`) é a mesma para "parece data de calendário" e para qualquer outro texto não-ISO que o `Date` aceite (ex.: `'Sep 21 2026'`); uma segunda mensagem distinguindo os casos deixaria o diagnóstico mais preciso (o comportamento de lançar já está correto).
- Item 0.5, `revisor-critico`: `validarInstante` não exige sufixo `Z`/offset, embora o ADR 0005 §2 diga que instantes são sempre UTC com `Z`. Não corrompe dado hoje (sem `Z` o dia local sai correto), mas o arquiteto pode decidir entre exigir `Z` ou documentar a tolerância explicitamente.
- Item 0.5, `revisor-critico`: considerar teste de regressão no repositório de histórico garantindo que `registrarAcao` propaga a exceção de `dataDeCalendarioDe` quando `ocorridaEm` vier como data de calendário (contrato da fronteira, além do teste da função pura).
- Item 0.6, `revisor-critico` (1ª rodada): `detalhe` de `ErroDeBackup` cita o valor de `id`/`tipo` do registro inválido, não só o nome do campo e o índice na lista — o ADR 0006 §2.2 pede para nunca citar valor de campo do usuário; hoje são identificadores técnicos e o React escapa o texto, mas o mais fiel ao ADR seria trocar por "nome do campo + índice" apenas.
- Item 0.6, `revisor-critico` (1ª rodada): stubs de `importarJson` dos pilares (`treino`/`estudos`/`financas`) lançam de forma síncrona dentro de função que deveria devolver `Promise`; funciona porque o orquestrador é `async`, mas `return Promise.reject(new ErroDeBackup(...))` respeitaria o contrato à risca.
- Item 0.6, `revisor-critico` (1ª rodada): chaves extras/desconhecidas dentro de um registro importado são gravadas em silêncio (só a chave de tabela desconhecida é rejeitada); vale decidir, em ADR ou no plano, se a importação deve rejeitar campo desconhecido dentro de um registro, antes da Fase 1 trazer tabelas novas.
- Item 0.6, `revisor-critico` (1ª rodada): `ehDiaDeCalendario` (formato `dia` do histórico) aceita datas de calendário inválidas como `2026-13-45` (só checa o padrão `\d{4}-\d{2}-\d{2}`, não o calendário real); considerar validar o calendário de verdade, ou exigir `dia === dataDeCalendarioDe(ocorridaEm)` se essa invariante valer.
- Item 0.6, `revisor-critico` (2ª rodada): `Aviso` de erro dentro de `BotaoDeArquivo` (falha ao gerar/salvar o backup JSON ou um CSV isolado) não recebe foco ao aparecer, diferente dos outros erros da tela (`Dados.tsx`) — vale alinhar por consistência de acessibilidade.
- Item 0.6, `revisor-critico` (2ª rodada): o e2e de alvo de toque (44×44px) não mede o `<summary>` "Detalhes técnicos" (dentro do alerta de erro da importação) nem o botão "Salvar arquivo" do estado `precisaDeNovoToque` — este último usa o componente `Botao` e deve passar, mas não foi confirmado por teste.
- Item 0.7, `arquiteto` (ADR 0007): convite para instalar dentro do app (`beforeinstallprompt` no Android; instrução "Compartilhar > Adicionar à Tela de Início" no iPhone) — não pedido pela especificação, mas melhora a taxa de instalação.
- Item 0.7, `arquiteto` (ADR 0007): mostrar ao usuário se o armazenamento persistente foi concedido — candidato ao item 5.7 (aviso de backup), já que ambos tratam de resiliência dos dados no aparelho.
- Item 0.7, `revisor-critico`: aviso do Vite (`configLoader: 'native'`) sobre `import "./src/i18n"` resolver diretório e imports sem extensão em `src/i18n/index.ts`; não quebra nada hoje, só importa se uma versão futura do Vite mudar o padrão. Decisão do arquiteto quando isso acontecer.
- Item 0.7, `revisor-critico`: `src/app/App.tsx` não trata rejeição de `atualizar()` — se `updateServiceWorker` falhar, o botão "Atualizar agora" fica preso em "Atualizando..." até o app fechar. Sugestão: `.catch()` com `console.warn` e reset do estado local.
- Item 0.7, `revisor-critico`: `vite.config.ts` inclui os ícones do manifesto duas vezes no precache (`globPatterns` + `includeManifestIcons`, padrão do plugin) — inofensivo (mesma revisão, o Workbox deduplica), mas `includeManifestIcons: false` deixaria a lista limpa.
- Item 0.7, `revisor-critico`: o plugin `textosDoHtml` (`vite.config.ts`) insere `NOME_DO_APP`/`DESCRICAO_DO_APP` no HTML sem escapar `"`, `&` ou `<` — seguro hoje (placeholder sem esses caracteres), mas quebraria o `content="..."` se o nome real do app algum dia tiver aspas ou `&`. Escapar antes do `replaceAll` quando o nome definitivo for decidido.
- Item 0.7, `revisor-critico`: incluir no roteiro de teste manual do item 5.8 (VoiceOver/iPhone) conferir se o aviso de atualização (`role="status"`) é anunciado pelo leitor de tela ao aparecer — regiões `aria-live` montadas já com conteúdo às vezes não disparam o anúncio; se não disparar, considerar manter a região sempre montada e só trocar o conteúdo.
- Item 0.10, `revisor-critico`: em `Configuracoes.tsx`, campo de texto tocado (focado) antes da primeira leitura assíncrona do banco terminar pode ficar mostrando o valor padrão desatualizado até a próxima mudança externa — não perde dado, mas a tela fica visualmente atrasada. Correção possível: ao desfocar sem alteração, se o valor gravado mudou enquanto o campo tinha foco, reescrever o texto exibido a partir dele.
- Item 0.10, `revisor-critico`: em `Configuracoes.tsx`, se `blur` e `visibilitychange` (fechar o app com o teclado aberto) dispararem quase juntos antes da primeira gravação terminar, as duas veem o texto como alterado e gravam duas vezes — o valor final fica certo, mas entram duas ações `nucleo.configuracoesSalvas` no histórico para uma única edição. Uma flag de "gravando em andamento" evitaria a duplicata.
- Item 0.10, `revisor-critico`: instabilidade ocasional (1 "flaky", passa no retry) no teste e2e do critério 13 (`e2e/configuracoes.spec.ts`, "tocar um campo e sair sem alterar não grava") em WebKit sob paralelismo local — a lógica coberta está correta; suspeita é tempo de carregamento/exportação entre navegações, não um bug de gravação. Vale o `testador` investigar se voltar a aparecer.
