# 0010. Prints de fase gerados pela suíte e2e (iPhone emulado)

- Data: 2026-09-23
- Status: proposta

## Contexto

Item 0.13 do `docs/PLANO.md`. **D6**: o relatório de fase vai com prints das telas principais em iPhone emulado; o usuário acompanha visualmente sem testar (D2). O `CLAUDE.md` fixa a pasta `docs/prints/fase-N/`.

O que já existe e amarra a decisão:

| Peça | Estado |
|---|---|
| `package.json` | `"test:e2e": "playwright test"` e `"test:e2e:prints": "playwright test prints --project=iphone-webkit"` (item 0.2, nunca usado) |
| `playwright.config.ts` | `testDir: './e2e'`, projetos `iphone-webkit` (`devices['iPhone 15']`) e `android-chromium`, `locale: 'pt-BR'`, `timezoneId: 'America/Sao_Paulo'` |
| CI (ADR 0003 §8) | roda `npm run test:e2e -- --grep-invert "@prints"`; todo teste de print leva `@prints` no título |
| `.prettierignore` | já ignora `docs/prints`; `.gitignore` não ignora (os PNG são versionados, ADR 0002) |
| Telas (Fase 0) | Hoje (`/`), Configurações (`/configuracoes`), Dados (`/dados`), atrás da moldura comum; page objects `PaginaHoje`, `PaginaConfiguracoes`, `PaginaDados` |
| Tema | padrão "sistema" (D11), resolvido por `matchMedia('(prefers-color-scheme: dark)')` no `index.html` e em `useAplicarTema` |

Problema concreto: hoje, sem mudança, **`npm run test:e2e` pegaria `e2e/prints.spec.ts`** (o `testDir` inclui todo `*.spec.ts`), nos dois projetos, e reescreveria os PNG versionados a cada rodada completa do `testador` — sujando o `git status` em toda entrega e gerando prints de Android.

## Decisão

### 1. Quais telas (Fase 0)

| Arquivo | Tela | Tema |
|---|---|---|
| `hoje.png` | Hoje | claro |
| `hoje-escuro.png` | Hoje | escuro |
| `configuracoes.png` | Configurações | claro |
| `dados.png` | Dados | claro |

Tema escuro **só na Hoje**: é a tela central do produto e basta um print para mostrar que o tema existe e funciona. Duplicar todas as telas dobra arquivos e tempo sem informação nova para quem só olha. O escuro é obtido com `test.use({ colorScheme: 'dark' })` sobre a configuração padrão "sistema" — zero passo de interface, sem mexer em dado. Os prints claros declaram `colorScheme: 'light'` explicitamente, para não depender do padrão do Playwright.

### 2. Onde e como nomear (vale para todas as fases)

- Pasta: `docs/prints/fase-<N>/`, com `N` vindo de uma constante no topo do spec: `const FASE = 0;`. A cada fase o `testador` atualiza a constante e a lista de telas no mesmo commit. Sem variável de ambiente (definir env no PowerShell e no bash é diferente, e `cross-env` seria dependência só para isso).
- Nome: `<tela>[-<estado>][-escuro].png`, kebab-case, pt-BR **sem acento**, igual ao já previsto em `.claude/agents/testador.md` (ex.: `hoje.png`, `treino-em-andamento.png`, `hoje-escuro.png`). Sem prefixo numérico: evita renumerar quando uma fase acrescenta tela.
- A **ordem** do relatório é a ordem da lista `PRINTS` no spec, e a Hoje é sempre a primeira.
- Cada fase gera o conjunto completo das telas principais existentes naquele momento (não só as novas). Pastas de fases anteriores nunca são regeneradas: são o histórico visual.
- Tela renomeada ou removida deixa arquivo órfão na pasta da fase atual; o `testador` aponta no relatório e o orquestrador apaga (o `testador` não tem `rm` liberado).

### 3. Como o teste gera o print

```ts
await page.screenshot({ path, fullPage: true, animations: 'disabled' });
```

- **`fullPage: true`** em todas. A Hoje cabe na tela sem rolar (ADR 0009), então o resultado é igual ao viewport; Configurações e Dados rolam, e o usuário precisa ver a tela inteira para acompanhar sem testar. Um critério único para todas as telas é mais simples que decidir por tela.
- Viewport e densidade vêm de `devices['iPhone 15']` (393 px de largura CSS, `deviceScaleFactor` 3 → PNG com **1179 px** de largura). Escala padrão (`device`): nítido quando aberto no celular.
- `animations: 'disabled'` evita print no meio de transição. O cursor de texto já é escondido por padrão (`caret: 'hide'`).
- Antes do print: `abrir()` do page object (espera o `h1`). Nada de `waitForTimeout`.
- Cada teste importa `test`/`expect` de `e2e/fixtures/base.ts` (guarda de console, ADR 0004 §4.1): print de tela com erro no console falha em vez de ir para o relatório.

### 4. Banco vazio na Fase 0

**Banco vazio.** Motivos: (a) na Fase 0 nenhuma tela mostra dado de pilar — os cartões são "Em breve" e Configurações mostra os padrões de D11 com ou sem backup; importar `backup-exemplo.json` não mudaria nada visível; (b) importar pela tela Dados acrescentaria um fluxo inteiro como pré-condição dos prints, com custo e chance de falha sem ganho; (c) banco vazio é exatamente o primeiro uso que o usuário vai ver.

Regra para as fases 1 a 5 (quando houver dado para mostrar): os prints usam um backup de exemplo em `e2e/fixtures/`, **importado pela tela Dados** (`PaginaDados.escolherArquivoParaImportar` + confirmar), que é o único caminho sem acesso direto ao banco (ADR 0004 §6.9). Cada fase decide o conteúdo do seu exemplo na própria entrega. Atenção: backup de versão de schema diferente é bloqueado (pendência 33), então o arquivo de exemplo acompanha toda migração.

Isolamento: o Playwright cria um `BrowserContext` novo para cada teste (fixture `page` com escopo de teste), com IndexedDB, service worker e storage próprios. Nada que um print prepara vaza para outro teste nem para os outros specs. Não é preciso limpeza.

### 5. Rodar só com `npm run test:e2e:prints`, só em iPhone

- O argumento posicional `prints` do Playwright é uma expressão regular aplicada ao caminho dos arquivos de teste; casa com `e2e/prints.spec.ts` e com nenhum outro spec existente. O script continua como está.
- `--project=iphone-webkit` garante só iPhone. Como reforço, o spec tem no topo `test.skip(({ browserName }) => browserName !== 'webkit', 'Prints (D6) só em iPhone emulado')`, para que um `npx playwright test prints` sem `--project` não gere prints de Android. É a única exceção a D3 deste item, com motivo em D6.

### 6. Fora de `npm run test:e2e`

Muda **uma linha** do `package.json`:

```json
"test:e2e": "playwright test --grep-invert @prints",
```

- Todo teste de `e2e/prints.spec.ts` leva `@prints` no título (ADR 0003 §8 já exige), e o `--grep-invert` exclui os títulos que casam.
- O `test:e2e:prints` não passa `--grep-invert`, então os prints rodam.
- O `ci.yml` **não muda**: ele passa `--grep-invert "@prints"` de novo, com o mesmo valor; o Playwright fica com o último, que é idêntico. A duplicidade é inofensiva e remover dá trabalho em `.github/` sem ganho.
- Protocolo do ADR 0004 §7 ("rodar a suíte inteira") continua valendo: "suíte inteira" passa a ser `npm run test:e2e`, que por definição não inclui prints.

### 7. Quem faz o quê

- **`testador`**: cria `e2e/prints.spec.ts`, altera a linha `test:e2e` do `package.json` (autorizado por este ADR; é script de teste), roda `npm run test:e2e:prints` e entrega os 4 PNG em `docs/prints/fase-0/`.
- **`interface`**: nada. Se algum print sair com defeito visual real (texto cortado, sobreposição), vira apontamento para a `interface`, não ajuste no teste.
- **Orquestrador**: fora da alçada do arquiteto, ajustar `.claude/commands/fase.md` (passo 5 diz "rode a suíte e2e completa para gerar os prints"; passa a ser `npm run test:e2e:prints`) e a linha de prints de `.claude/agents/testador.md` ("no fim da suíte e2e" → "com `npm run test:e2e:prints`"; "com dados do seed" → "banco vazio na Fase 0; a partir da Fase 1, backup de exemplo importado pela tela Dados").

### 8. Critérios de aceite

1. `e2e/prints.spec.ts` existe, importa `test`/`expect` de `./fixtures/base`, declara `const FASE = 0` e uma lista `PRINTS` na ordem Hoje, Hoje escuro, Configurações, Dados; todo título de teste contém `@prints`.
2. `npm run test:e2e -- --list` não lista nenhum teste de `prints.spec.ts` e mostra a mesma contagem de testes de antes deste item.
3. `npm run test:e2e:prints -- --list` lista exatamente **4 testes**, todos de `prints.spec.ts` e todos no projeto `iphone-webkit`.
4. `npx playwright test prints` (sem `--project`) termina com os 4 testes de `android-chromium` pulados pelo `test.skip` condicional (o `--list` não avalia o skip, por isso a verificação é rodando) e os PNG gerados são os do iPhone (1179 px de largura, critério 6).
5. `npm run test:e2e:prints` termina verde partindo de um repositório sem `dist/` e sem `docs/prints/`, e cria exatamente `docs/prints/fase-0/hoje.png`, `hoje-escuro.png`, `configuracoes.png` e `dados.png`.
6. Cada PNG tem 1179 px de largura (393 × 3); `hoje.png` tem altura igual à do viewport (a Hoje não rola); `configuracoes.png` e `dados.png` mostram a tela inteira até o último controle.
7. Conferência visual (o `testador` abre os quatro arquivos e descreve no relatório; o `revisor` confere): textos em pt-BR, `h1` da tela visível, `hoje-escuro.png` com fundo escuro e os outros três claros, sem aviso de versão nova, sem tela de erro, sem conteúdo cortado no meio de animação.
8. Rodar `npm run test:e2e:prints` duas vezes seguidas não cria arquivo novo além dos quatro (só sobrescreve).
9. `npm run test:e2e` continua verde nos dois projetos e não altera nada em `docs/prints/` (`git status` limpo nessa pasta depois da rodada).
10. `npm run verificar` verde (lint, format e typecheck cobrem `e2e/`).
11. Nenhuma dependência nova; nenhuma alteração em `src/`, `playwright.config.ts` ou `.github/`; no `package.json` só a linha `test:e2e` muda.
12. Os quatro PNG são commitados junto com o spec (a pasta não é ignorada pelo git).
13. O relatório segue o bloco do ADR 0004 §7 e registra, na linha "Pulados / tolerados", o `test.skip` de navegador deste spec com o motivo (D6).

## Alternativas consideradas

- **Variável de ambiente para ligar os prints (`PRINTS=1`) ou para a fase (`FASE=N`)**, como o ADR 0002 esboçou. Sintaxe diferente em PowerShell e bash; resolver exigiria `cross-env`, dependência só para isso. A constante no spec e o `--grep-invert` no script resolvem sem nada novo.
- **Projeto `prints` separado no `playwright.config.ts`** (`testMatch` só no print, `testIgnore` nos outros). `playwright test` sem `--project` roda todos os projetos, então o projeto de prints rodaria na suíte normal do mesmo jeito; exigiria filtro de qualquer forma e mais configuração.
- **Nome fora do padrão `*.spec.ts`** (ex.: `prints.ts`) para o `testDir` ignorar. Exigiria mudar `testMatch` na configuração para o script achá-lo e deixaria o arquivo fora da convenção do ADR 0002.
- **Todas as telas nos dois temas.** Dobra arquivos e tempo sem informação nova; o escuro da Hoje prova o recurso.
- **`fullPage: false` (só o viewport).** Mostra o que cabe na primeira tela, mas esconde a parte de baixo de Configurações e Dados, que o usuário não vai rolar para ver (ele só olha os prints).
- **Importar `backup-exemplo.json` já na Fase 0.** Não muda nada visível hoje (seção 4) e acrescenta um fluxo como pré-condição.
- **Gerar prints no CI.** Já recusado no ADR 0003: exigiria permissão de escrita e commit automático.
- **Comparação visual (`toHaveScreenshot`).** Fora do escopo: D6 pede print para o usuário olhar, não teste de regressão visual. Fontes e renderização variam entre máquinas e dariam falso vermelho.

## Consequências

- Toda fase fecha com `npm run test:e2e:prints` e uma alteração pequena no spec (constante `FASE` + linhas novas na lista). O orquestrador só anexa os arquivos da pasta na ordem da lista.
- A suíte normal fica livre de efeito colateral em arquivo versionado.
- Os PNG crescem o repositório (algumas centenas de kB por fase). Aceitável; se passar de ~5 MB no total, reavaliar `scale: 'css'`.
- A partir da Fase 1, o backup de exemplo dos prints é mais um arquivo para acompanhar cada migração de schema (pendência 33).
- O `test.skip` por navegador fica registrado como exceção de D3, justificada por D6.
