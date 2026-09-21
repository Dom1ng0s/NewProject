# 0001. Stack técnica do PWA

- Data: 2026-09-21
- Status: **aceita**

## Contexto

A especificação (seção 4) exige escolher a stack antes de qualquer código, com dois requisitos duros: tipagem estática, execução offline, persistência local com migrações, testes unitários e e2e, e instalação pela tela inicial do celular. Os princípios da seção 3 proíbem qualquer dependência que envie dados para fora do dispositivo.

Restrições já decididas em `docs/PLANO.md`:

- **D1**: PWA puro, sem servidor próprio, sem Capacitor. Deploy é hospedagem estática.
- **D3**: e2e roda em WebKit (iPhone emulado) e Chromium (Android emulado).
- **D6**: os prints do relatório de fase saem da própria suíte e2e.
- Riscos técnicos 1 a 4 (notificação local, timer em segundo plano, storage apagado pelo navegador, `.apkg` via SQLite WASM).

O aparelho alvo é um iPhone e, por **D2**, o usuário só testa o produto final. Logo, **risco no Safari é o critério de desempate mais pesado**: um problema de WebKit que só aparecesse no fim custaria uma fase inteira.

Pontos comuns às duas opções (não estão em disputa):

- TypeScript em modo `strict`, build com **Vite**.
- PWA com **vite-plugin-pwa** (Workbox por baixo; `injectManifest` para controlar o service worker à mão). Ativamente mantido (1.3.0, mai/2026).
- e2e com **Playwright** (descritores de dispositivo iPhone/WebKit e Pixel/Chromium, `page.screenshot()` para D6) + **@axe-core/playwright** para o teste automático de acessibilidade.
- Unitários com **Vitest** (mesma config do Vite; as regras da seção 7 são funções puras, rodam em Node sem DOM).
- **ESLint 9** (flat config) + **Prettier** + `tsc --noEmit`, tudo verificado no CI.
- FSRS: **ts-fsrs** (open-spaced-repetition, MIT, commit de set/2026). Não reescrever o algoritmo (seção 6.1).
- CI: **GitHub Actions** (lint, tipos, unitários, e2e, build a cada push).
- Hospedagem: estática com HTTPS, preview por branch e sem script de analytics injetado.
- Nenhuma das dependências acima faz chamada de rede em tempo de execução.

## Decisão

Escolhida a **Opção A — React 19 + Dexie (IndexedDB)**, com hospedagem em **Cloudflare Pages**, conforme resposta do usuário em 2026-09-21.

Confirmado explicitamente: `dexie-cloud-addon` (sincronização paga) não será instalado.

## Alternativas consideradas

### Opção A — React + Dexie (IndexedDB)

| Camada | Escolha |
|---|---|
| UI | React 19 + TypeScript strict |
| Roteamento | React Router (modo biblioteca, SPA com fallback) |
| Estado | `dexie-react-hooks` (`useLiveQuery`) para dados + Zustand só para estado efêmero de tela |
| Persistência | **Dexie 4** sobre IndexedDB (Apache-2.0) |
| Migrações | `db.version(n).stores({...}).upgrade(tx => ...)`, nativo do Dexie, testável em Node com `fake-indexeddb` |
| Backup | serialização JSON/CSV a partir dos repositórios |
| `.apkg` | `sql.js` (ou `@sqlite.org/sqlite-wasm`) carregado por `import()` dinâmico **só na tela de importação**, em memória, mais `fflate` para o zip |

**Prós**

- IndexedDB é suportado em todo lugar, inclusive em aba privada do Safari. Zero risco de plataforma.
- Nada de WASM no caminho crítico: ajuda o requisito "tela Hoje interativa em menos de 2 s".
- `useLiveQuery` dá reatividade automática: os critérios "recalculado imediatamente, sem recarregar" (7.3, 7.4) saem de graça.
- Custo de manutenção baixo: poucas peças, todas de primeira linha e com ecossistema grande.
- Escrita transacional do IndexedDB atende "gravações atômicas" (seção 8) sem esforço extra.
- O peso do SQLite WASM fica isolado na Fase 3 e só é baixado por quem importar um `.apkg` (resolve a pendência 7 do plano).

**Contras**

- Sem SQL: agregações (heatmap anual, séries por grupo muscular, volume semanal) são feitas em JavaScript. Para um usuário só, o volume é irrisório; ainda assim é código nosso em vez de `GROUP BY`.
- Migrações são funções JS, menos formais que arquivos `.sql` versionados. Mitigação: um teste unitário por migração, obrigatório (item 0.5).
- O pacote `dexie` é o núcleo; `dexie-cloud-addon` (sincronização paga) é pacote separado e **não será instalado** — precisa ficar escrito no ADR para ninguém adicionar por engano.

**Riscos do plano**

1. Notificação local: não resolve (nenhuma stack resolve sem servidor). Fica o tratamento de D1 — faixa na tela Hoje + Badging API quando o PWA estiver instalado no iPhone.
2. Timer em segundo plano: valor exibido calculado pelo horário de início; alerta sonoro só com o app em primeiro plano.
3. Storage apagado: `navigator.storage.persist()` + incentivo a exportar. IndexedDB em PWA instalado no iOS é o cenário mais estável que existe hoje.
4. `.apkg`: resolvido com carga sob demanda, sem custo para quem não usa.

### Opção B — Svelte 5 + SQLite WASM (OPFS)

| Camada | Escolha |
|---|---|
| UI | Svelte 5 (runes) + SvelteKit com `adapter-static` |
| Roteamento | roteador de arquivos do SvelteKit, SPA fallback |
| Estado | runes `$state`/`$derived`, sem biblioteca de estado |
| Persistência | **SQLite WASM em OPFS** via SQLocal/wa-sqlite, num Web Worker |
| Migrações | arquivos `.sql` numerados + `PRAGMA user_version` (ou Drizzle + drizzle-kit) |
| Backup | JSON/CSV por consulta, e possibilidade de exportar o arquivo `.db` inteiro |
| `.apkg` | reaproveita o mesmo motor SQLite já embarcado |

**Prós**

- SQL de verdade: agregações e relatórios ficam declarativos e rápidos.
- Migrações em `.sql` versionado é o padrão mais maduro da indústria para "nunca quebrar dados de uma versão anterior".
- Svelte 5 gera bundle menor que React e tem reatividade fina sem biblioteca extra.
- O motor de `.apkg` já está lá.

**Contras e riscos**

- **É o ponto fraco justamente no iPhone.** OPFS em Safari depende de `SyncAccessHandle` em worker, tem histórico de bugs, **não existe em aba privada**, e algumas builds exigem cabeçalhos COOP/COEP (isolamento cross-origin) — o que elimina o GitHub Pages como hospedagem e obriga configurar `_headers`.
- ~1 MB de WASM no caminho crítico, contra o requisito de 2 s na tela Hoje.
- Toda a persistência vira assíncrona atravessando um Worker: mais complexidade em cada repositório.
- Mais peças para manter (SQLocal/wa-sqlite, VFS, Drizzle) e menos gente para achar o bug quando ele aparecer.
- Fallback obrigatório para IndexedDB quando OPFS falhar — ou seja, na prática acabaríamos mantendo **duas** camadas de persistência.

### Descartadas sem detalhamento

- **Vue/Nuxt, SolidJS, Qwik**: viáveis, mas sem vantagem sobre as duas acima para este escopo.
- **RxDB, WatermelonDB**: camadas grandes pensadas para sincronização, que está fora do escopo (seção 12).
- **localStorage**: síncrono, limite baixo, sem índices. Inadequado.
- **Netlify** como hospedagem: plano gratuito passou a ser por créditos, com risco de suspensão.
- **Vercel**: gratuito só para uso não comercial e injeta analytics por padrão em alguns fluxos — atrito com o princípio 5.

## Hospedagem proposta (item 0.9)

**Cloudflare Pages**, ligado ao repositório no GitHub: HTTPS automático, banda ilimitada no plano gratuito, **preview por branch** (atende D6), suporte a `_headers` e `_redirects` (SPA fallback e, se um dia for preciso, COOP/COEP) e nenhum script de analytics injetado — o Web Analytics da Cloudflare é opt-in e não será ativado.

Alternativa mais simples: **GitHub Pages** (zero contas novas, deploy pelo próprio GitHub Actions), ao custo de não ter preview por branch e não permitir cabeçalhos customizados.

## Consequências

- Estrutura de pastas por módulo em React + TypeScript strict (item 0.2), com Dexie como única camada de persistência do IndexedDB e `fake-indexeddb` disponível para os testes unitários de migração.
- Todo repositório usa `useLiveQuery`/Dexie diretamente; nenhuma tela acessa o banco sem passar pela interface pública do módulo (regra do `CLAUDE.md`).
- `sql.js`/`@sqlite.org/sqlite-wasm` só entra como dependência na Fase 3, sob `import()` dinâmico, isolado na tela de importação `.apkg`.
- Deploy: repositório conectado ao Cloudflare Pages (build Vite, saída em `dist/`), com preview automático por branch/PR para os relatórios de fase (D6). Passo a passo de conexão enviado ao usuário como parte do item 0.9.
- `CLAUDE.md` (seção Stack e Comandos) e `.claude/settings.json` devem ser atualizados para refletir esta stack antes do item 0.2 começar.
