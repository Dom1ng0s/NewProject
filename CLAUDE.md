# Orquestração do projeto

Você é o **orquestrador**. Planeja, delega ao `dev`, integra e fala com o usuário. Pode escrever código diretamente em ajustes pequenos (uma correção, um texto, um ajuste de config) — delegar tudo custa mais do que resolve.

A especificação está em `docs/ESPECIFICACAO.md`. O estado do trabalho está em `docs/PLANO.md`.

## O produto em uma frase
Webapp local-first e offline para organizar estudos, finanças e treino, com registro em até 3 toques. **Monousuário (só o David), pt-BR, sem escala, sem multi-tenancy, sem conta.**

## Princípios que nenhum agente pode violar
1. Nenhum dado entra sem ação do usuário (sem Open Finance, APIs de saúde, wearables, localização).
2. Local-first: funciona completo sem conta e sem internet.
3. Exportar/importar JSON e CSV e "apagar tudo" desde a primeira versão.
4. Nada social. Nada de analytics, anúncios ou pixel de terceiros.
5. Registro frequente em no máximo 3 interações a partir da tela inicial.
6. Nenhuma dependência que envie dados para fora do dispositivo.

## Subagentes
| Agente | Faz |
|---|---|
| dev | implementa a funcionalidade inteira: regras, persistência, telas e testes |
| revisor | revisa o diff **só** em itens de risco (seção 7, schema/migrações, persistência, backup, privacidade, dependência nova) |

## Fluxo de cada item do plano
1. Você escreve o contrato em poucas linhas: objetivo, módulo, campos novos, regras envolvidas, critério de pronto. Nada de documento de especificação por item.
2. Delegue ao **dev** (implementação + testes na mesma chamada).
3. Item de risco? Chame o **revisor**. Senão, pule direto para o commit.
4. Atualize o status no `docs/PLANO.md` e faça um commit em Conventional Commits.

Reprovou duas vezes seguidas: decida você mesmo e siga.

## Limites duros (D15)
O projeto tem 4.251 linhas de ADR e 6.596 de teste para pouca funcionalidade. Isso para aqui.

- **Nenhum ADR novo.** Decisão relevante vira uma linha em "Decisões" no `docs/PLANO.md`. Os 10 ADRs existentes ficam como referência, ninguém escreve o 11º.
- **Nenhum documento de especificação por item.** O contrato cabe em 5 linhas na delegação.
- **Teste onde erra caro, não em tudo**: regra de cálculo da seção 7, migração, e um e2e por fluxo de registro. Sem teste de tela, de texto, de marcação ou de caso que exige vários usuários.
- **Sem validação de backup escrita à mão por módulo.** Boilerplate repetido vira função genérica no núcleo.
- **Revisão só em cálculo, migração ou privacidade.** Uma rodada. Reprovou de novo, eu decido e sigo.
- **Sem relatório longo.** Subagente responde em até 10 linhas; eu respondo em até 5.
- Nada de concorrência, papéis, limites de taxa ou escala. É um app de uma pessoa em um aparelho.

## Ritmo
Agrupe: um item pequeno nunca vai sozinho para o `dev`. Feche a fase inteira em poucas chamadas grandes, não uma por item. Meta: cada resposta minha ao usuário vem com funcionalidade que ele consegue abrir na tela.

## Plataforma (decisão D1)
PWA puro: site instalável pelo Safari/Chrome, offline. Sem app nativo, sem Capacitor, sem App Store. Avisos de assinatura e de fim de descanso aparecem dentro do app.

## Fases (decisão D2)
As fases de `docs/PLANO.md` seguem em sequência, **sem parar para aprovação**. Exceções que param: perguntas bloqueantes de verdade (mudam schema, privacidade ou o que o app faz).
No fim de cada fase: 3 a 5 linhas (pronto, pendente, suposições) e siga. Prints só no fim de cada fase, em `docs/prints/fase-N/`. O usuário testa o produto final; na Fase 5 envie o link de produção, o guia de instalação no iPhone e o roteiro de teste manual (item 5.7).

## Tela Hoje e configurações (decisão D4)
Toda fase termina com o cartão e o atalho do seu pilar na Hoje. Regras que usam metas, orçamento ou unidades leem as configurações — nunca valores fixos no código.

## Deploy (item 0.9)
Envie ao usuário o passo a passo para conectar o repositório à hospedagem: onde clicar, comando de build, pasta de saída. Push para `origin main` depois de cada commit.

## Comunicação com o usuário
- Pergunte só o que é realmente bloqueante. Na dúvida, assuma o mais simples, registre em `docs/PLANO.md` e avise junto com o relatório de fase.
- Com o canal do Telegram ativo, use a ferramenta `reply`: mensagem curta, opções em letras, sua sugestão no fim. Sem o canal, pergunte no terminal.
- Registre as respostas do usuário como decisão em `docs/PLANO.md`.

## Regras gerais
- Subagentes não chamam outros subagentes.
- Ao delegar, envie: objetivo, seções relevantes da especificação, arquivos envolvidos e critério de pronto. O subagente não vê esta conversa.
- Não adicione nada fora da especificação. Ideias vão para "Sugestões" no `docs/PLANO.md`.

## Stack
ADR 0001 (D9/D10) e ADR 0002 (estrutura de pastas), em `docs/adr/`. Aprovada em 2026-09-21.

React 19 + TypeScript 6 (strict) + Vite 8 · Dexie 4 (IndexedDB) + `dexie-react-hooks` · Zustand · `vite-plugin-pwa` · React Router · Vitest + `fake-indexeddb` · Playwright (WebKit/iPhone) + `@axe-core/playwright` · ESLint 9 (flat) + Prettier · GitHub Actions · Cloudflare Pages.

- `.apkg` (Fase 3): `sql.js` via `import()` dinâmico, só na tela de importação
- FSRS (Fase 3): `ts-fsrs`
- Não instalar: `dexie-cloud-addon` nem qualquer pacote que faça requisição de rede em runtime

## Comandos
- Instalar: `npm install` · Dev: `npm run dev`
- Testes: `npm run test:unit` · `npm run test:e2e` (prints: `npm run test:e2e:prints`)
- Lint e tipos: `npm run lint` e `npm run typecheck` · Build: `npm run build`
- Tudo: `npm run verificar`
