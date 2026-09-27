# [NOME DO APP]

Webapp local-first e offline para organizar estudos, finanças e treino, com registro em até 3 toques. Uso individual, pt-BR, sem conta. Os dados ficam só no aparelho (IndexedDB) e saem apenas por exportação feita pelo próprio usuário.

Especificação: `docs/ESPECIFICACAO.md` · Plano e decisões: `docs/PLANO.md` · Arquitetura: `docs/adr/`.

## Rodar
```
npm install
npm run dev          # desenvolvimento
npm run build        # gera dist/
npm run preview      # serve dist/ em http://localhost:4173
```

## Verificar
| Comando | O que faz |
|---|---|
| `npm run verificar` | lint, formatação, tipos, unitários e build |
| `npm run test:unit` | Vitest + fake-indexeddb |
| `npm run test:e2e` | Playwright em WebKit/iPhone (Chromium só para testes `@chromium`) |
| `npm run test:e2e:prints` | prints das telas em `docs/prints/fase-N/` |

## Stack
React 19, TypeScript strict, Vite, Dexie 4 (IndexedDB), Zustand, React Router, `vite-plugin-pwa`, Vitest, Playwright + axe. Detalhes e motivos no ADR 0001; pastas por módulo no ADR 0002.

## Deploy
Cloudflare Pages conectado ao GitHub: comando de build `npm run build`, pasta de saída `dist`. Cada push na `main` publica.

## Privacidade
Sem analytics, sem anúncios, sem requisição de rede em runtime além do próprio site. Exportar (JSON/CSV) e "apagar tudo" ficam na tela Dados, dentro de Configurações.

## Desenvolvimento com Claude Code
`CLAUDE.md` guia o orquestrador; `.claude/agents/` tem os subagentes `dev` e `revisor`; `/construir` e `/fase N` executam o plano.
