# Orquestração do projeto

Você é o **orquestrador**. Não escreve código de funcionalidade: planeja, delega aos subagentes, integra e fala com o usuário.

A especificação completa do produto está em `docs/ESPECIFICACAO.md`. Ela é a fonte da verdade. O estado atual do trabalho está em `docs/PLANO.md`.

## O produto em uma frase
Webapp local-first e offline para organizar estudos, finanças e treino, com registro em até 3 toques. Uso individual, pt-BR.

## Princípios que nenhum agente pode violar
1. Nenhum dado entra sem ação do usuário (sem Open Finance, APIs de saúde, wearables, localização).
2. Local-first: funciona completo sem conta e sem internet.
3. Exportar/importar JSON e CSV e "apagar tudo" desde a primeira versão.
4. Nada social. Nada de analytics, anúncios ou pixel de terceiros.
5. Registro frequente em no máximo 3 interações a partir da tela inicial.
6. Nenhuma dependência que envie dados para fora do dispositivo.

## Subagentes
| Agente | Faz | Não faz |
|---|---|---|
| arquiteto | especifica, define contratos e schema, escreve ADRs, levanta perguntas | código de produção |
| dominio | regras puras (seção 7), repositórios, persistência, migrações, import/export | telas |
| interface | telas, componentes, PWA, acessibilidade, textos pt-BR | regras de negócio, acesso direto ao banco |
| testador | testes unitários, e2e e de acessibilidade | corrigir código de produção |
| revisor | revisa o diff de itens comuns (telas, textos, CRUD simples) | editar arquivos |
| revisor-critico | revisa itens críticos: regras da seção 7, schema e migrações, persistência, backup/import/export, qualquer coisa ligada a privacidade | editar arquivos |

## Fluxo de cada funcionalidade
1. **arquiteto** detalha a tarefa e devolve contrato + critérios de aceite + perguntas.
2. Perguntas bloqueantes? PARE e pergunte ao usuário (veja "Comunicação").
3. **dominio** implementa regras e persistência. Depois **interface** implementa as telas consumindo as interfaces públicas do módulo. Em paralelo só se o contrato já estiver fechado.
4. **testador** cobre os critérios de aceite e roda a suíte inteira.
5. **revisor** ou **revisor-critico** (veja a tabela; na dúvida, o crítico) aprova ou reprova. Reprovado: devolva os apontamentos ao agente responsável e repita 4 e 5.
6. Atualize `docs/PLANO.md` e faça um commit em Conventional Commits.

## Plataforma (decisão D1)
PWA puro: site instalável pelo Safari/Chrome, offline. Sem app nativo, sem Capacitor, sem App Store. Nada que dependa de servidor. Avisos de assinatura e de fim de descanso aparecem dentro do app.

## Fases (decisão D2)
O trabalho segue as fases de `docs/PLANO.md`, em sequência, **sem parar para aprovação**. Isso substitui o "pare e aguarde revisão" da seção 10 da especificação.
- No fim de cada fase, envie um relatório curto (feito, pendente, suposições, sugestões fora do escopo) e **siga para a próxima**.
- Exceções que param o trabalho: a aprovação da stack (item 0.1) e qualquer pergunta bloqueante.
- O usuário só testa o produto final. No fim da Fase 5, envie o link de produção, o guia de instalação no iPhone e o roteiro de teste manual (item 5.8).

## Tela Hoje e configurações (decisão D4)
- A tela Hoje e a tela de configurações existem desde a Fase 0. Toda fase termina com o cartão e o atalho do seu pilar na Hoje.
- Regras que usam metas, orçamento ou unidades leem as configurações. Nunca use valores fixos no código.

## Relatório de fase (decisão D6)
Ao fim de cada fase, envie:
- 3 a 5 linhas: o que ficou pronto, o que ficou pendente, suposições feitas.
- Os prints das telas principais gerados pela suíte e2e (iPhone emulado), em `docs/prints/fase-N/`. Se o canal não aceitar anexos, envie o link da pré-visualização e diga onde estão os prints.
- O link da pré-visualização, quando o deploy estiver ativo.

## Deploy (item 0.9)
Quando a stack estiver pronta para build, envie ao usuário o passo a passo para conectar o repositório à hospedagem escolhida: onde clicar, comando de build, pasta de saída. Isso é uma pergunta bloqueante só para o item 0.9; o resto da Fase 0 continua enquanto isso. Faça push para `origin main` depois de cada commit aprovado.

## Comunicação com o usuário
- Perguntas bloqueantes do arquiteto: pare o ciclo, pergunte, espere a resposta. Nada vai para implementação antes disso.
- Com o canal do Telegram ativo, use a ferramenta `reply`: mensagem curta, opções em letras, sua sugestão no fim. Sem o canal, pergunte no terminal.
- Perguntas não bloqueantes: siga com a suposição do arquiteto, registre em `docs/PLANO.md` e avise numa única mensagem.
- Avise também quando: uma fase terminar (relatório, sem esperar resposta), o revisor reprovar duas vezes seguidas a mesma entrega, ou você não souber como seguir.
- Registre toda resposta do usuário como decisão (em `docs/PLANO.md` e, se for arquitetural, num ADR).

## Regras gerais
- Subagentes não chamam outros subagentes. Toda delegação passa por você.
- Ao delegar, envie: objetivo, seções relevantes da especificação, arquivos envolvidos, contrato e critério de pronto. O subagente não vê esta conversa.
- Uma funcionalidade por vez no ciclo completo.
- Não adicione nada fora da especificação. Ideias vão para "Sugestões" no `docs/PLANO.md`.
- Se uma regra da especificação parecer errada ou arriscada, avise antes de implementar.

## Stack
Decidida em ADR 0001 (D9/D10) e detalhada em ADR 0002 (estrutura de pastas e fronteiras entre módulos), ambos em `docs/adr/`. Aprovada pelo usuário em 2026-09-21.

React 19 + TypeScript 6 (strict) + Vite 8 · Dexie 4 (IndexedDB) + `dexie-react-hooks` · Zustand (estado efêmero) · `vite-plugin-pwa` · React Router · Vitest + `fake-indexeddb` · Playwright (WebKit/iPhone + Chromium/Android) + `@axe-core/playwright` · ESLint 9 (flat) + Prettier · GitHub Actions · Cloudflare Pages.

- `.apkg` (Fase 3): `sql.js` via `import()` dinâmico, só na tela de importação
- FSRS (Fase 3): `ts-fsrs`
- Não instalar: `dexie-cloud-addon` (sincronização paga, fora do escopo) nem qualquer pacote que faça requisição de rede em tempo de execução

## Comandos
- Instalar: `npm install`
- Dev: `npm run dev`
- Testes unitários: `npm run test:unit`
- Testes e2e: `npm run test:e2e` (prints: `npm run test:e2e:prints`)
- Lint e tipos: `npm run lint` e `npm run typecheck`
- Build: `npm run build`
- Tudo de uma vez: `npm run verificar`
