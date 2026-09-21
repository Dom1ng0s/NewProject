# 0002. Estrutura de pastas, fronteiras entre módulos e ferramentas de qualidade

- Data: 2026-09-21
- Status: **aceita**

## Contexto

Item 0.2 do `docs/PLANO.md`: "Estrutura de pastas por módulo, lint, formatação, tipos estritos". A stack está fechada no ADR 0001 (D9/D10) e não é reaberta aqui.

Restrições que a estrutura precisa respeitar:

- **Especificação, seção 5**: módulos por domínio `nucleo`, `estudos`, `financas`, `treino`; um módulo não acessa o armazenamento de outro; regras de negócio como funções puras; camada de repositório; schema versionado.
- **`CLAUDE.md`**: o agente `dominio` mexe em regras/repositórios/persistência; o agente `interface` mexe em telas e **nunca** acessa o banco direto. A estrutura precisa deixar isso óbvio e o lint precisa reprovar quando for violado.
- **Princípios 2, 3 e 6**: local-first, export/import/apagar tudo desde a v1, nenhuma dependência que fale com a rede.
- **D4**: tela Hoje e Configurações nascem na Fase 0 e ganham um cartão por pilar a cada fase, sem que o núcleo precise conhecer os pilares.
- **D3/D6**: e2e em WebKit (iPhone) e Chromium (Android), com prints gerados pela própria suíte.
- **Seção 8**: pt-BR com textos centralizados em arquivos de tradução; nome do app ainda é `[NOME DO APP]` (pendência 8/9).

Verificação do estado das ferramentas em 21/09/2026 (fontes ao fim do ADR):

| Ferramenta | Situação hoje | Efeito na decisão |
|---|---|---|
| TypeScript | 7.0 GA (jul/2026, compilador em Go); 6.0 é a última linha em JS | **Fixar 6.0.x.** O TS 7.0 não expõe a API programática do compilador (prevista para 7.1, beta em out/2026), então `typescript-eslint` não faz lint com informação de tipos em cima dele. Perder as regras de tipo (`no-floating-promises`, `no-misused-promises`) num app com IndexedDB é pior que perder velocidade de compilação. |
| typescript-eslint | 8.70.x, aceita ESLint `^8.57 \|\| ^9 \|\| ^10` e TypeScript `>=4.8.4 <6.1.0` | Confirma o teto de TS 6.0.x. |
| ESLint | 10.0 (fev/2026); flat config é o padrão | D9 diz "ESLint 9". Uso `^9` porque é o que todos os plugins declaram hoje; migrar para 10 é trocar uma linha e não muda nada deste ADR. |
| Vite | 8.3 estável | `vite-plugin-pwa` 1.3.0 declara `^3 \|\| ^4 \|\| ^5 \|\| ^6 \|\| ^7 \|\| ^8`: compatível. |
| Vitest | 5.0.x (set/2026) | Sem impacto no formato de config usado aqui. |
| Playwright | 1.63.0 (set/2026) | Descritores `iPhone`/`Pixel` e `page.screenshot()` atendem D3 e D6. |
| React | 19.3 (set/2026); não existe React 20 | D9 confirmado. |
| eslint-plugin-boundaries | 7.2.0, mantido, MIT, com flat config e correção específica para ESLint 10 | Avaliado e **não adotado** nesta fase (ver "Alternativas"). |

## Decisão

### 1. Árvore de pastas

```
/
├─ .github/workflows/ci.yml        # item 0.3
├─ docs/                           # ESPECIFICACAO, PLANO, adr/, prints/
├─ e2e/                            # Playwright (só o agente testador)
│  ├─ fixtures/                    # base de dados semeada, helpers de contexto
│  ├─ paginas/                     # page objects, um por tela
│  ├─ utilitarios/                 # ex.: verificarAcessibilidade(page)
│  ├─ acessibilidade.spec.ts
│  ├─ prints.spec.ts               # D6: gera docs/prints/fase-N/
│  └─ *.spec.ts
├─ public/
│  └─ icones/                      # ícones do PWA (chegam no item 0.7)
├─ src/
│  ├─ app/                         # casca da aplicação, não tem domínio
│  │  ├─ main.tsx                  # ponto de entrada
│  │  ├─ App.tsx                   # provedores + roteador
│  │  ├─ rotas.tsx
│  │  ├─ modulos.ts                # registro central dos módulos (ver seção 4)
│  │  ├─ provedores/               # tema, configurações, erro global
│  │  ├─ layout/                   # moldura, navegação inferior
│  │  └─ estilos/                  # tokens.css, global.css
│  ├─ persistencia/                # infraestrutura Dexie; só repositórios entram aqui
│  │  ├─ db.ts                     # instância única do Dexie
│  │  ├─ migracoes/
│  │  │  ├─ index.ts
│  │  │  └─ v1-inicial.ts          # uma migração por arquivo, numerada
│  │  ├─ tipos.ts                  # RegistroBase: id, createdAt, updatedAt, deletedAt
│  │  ├─ transacao.ts              # helper de escrita atômica (seção 8)
│  │  └─ index.ts                  # interface pública da camada
│  ├─ modulos/
│  │  ├─ nucleo/                   # configurações, backup, Hoje, XP (esp. 6.4)
│  │  │  ├─ dominio/
│  │  │  │  ├─ configuracoes.ts
│  │  │  │  ├─ backup/             # JSON, CSV, apagar tudo (item 0.6)
│  │  │  │  ├─ historico.ts        # registro de ações (item 0.12)
│  │  │  │  └─ xp.ts               # Fase 5, derivado do histórico (D5)
│  │  │  ├─ repositorio/
│  │  │  │  ├─ configuracoes.ts
│  │  │  │  ├─ historico.ts
│  │  │  │  ├─ backup.ts
│  │  │  │  └─ hooks.ts            # useLiveQuery -> único arquivo do dominio com React
│  │  │  ├─ telas/                 # Hoje.tsx, Configuracoes.tsx, Dados.tsx
│  │  │  ├─ componentes/
│  │  │  ├─ tipos.ts               # contratos que os pilares implementam
│  │  │  └─ index.ts               # INTERFACE PÚBLICA
│  │  ├─ treino/                   # Fase 1 (esp. 6.3)
│  │  │  ├─ dominio/               # regras 7.5 a 7.9, puras
│  │  │  ├─ repositorio/
│  │  │  ├─ telas/
│  │  │  ├─ componentes/
│  │  │  └─ index.ts
│  │  ├─ estudos/                  # Fases 2 e 3 (esp. 6.1)
│  │  │  ├─ comum/                 # matéria/projeto, compartilhado pelas duas áreas
│  │  │  │  ├─ dominio/
│  │  │  │  └─ repositorio/
│  │  │  ├─ foco/                  # Radar de Foco + Prazos (regra 7.2)
│  │  │  │  ├─ dominio/
│  │  │  │  ├─ repositorio/
│  │  │  │  ├─ telas/
│  │  │  │  └─ componentes/
│  │  │  ├─ flashcards/            # FSRS + regra 7.1
│  │  │  │  ├─ dominio/
│  │  │  │  ├─ repositorio/
│  │  │  │  ├─ telas/
│  │  │  │  └─ componentes/
│  │  │  └─ index.ts               # um único index para o módulo estudos
│  │  └─ financas/                 # Fase 4 (esp. 6.2), regras 7.3 e 7.4
│  │     ├─ dominio/
│  │     ├─ repositorio/
│  │     ├─ telas/
│  │     ├─ componentes/
│  │     └─ index.ts
│  ├─ compartilhado/               # utilitários genéricos, sem domínio e sem React
│  │  ├─ datas.ts                  # data de calendário ISO, semana de segunda a domingo
│  │  ├─ dinheiro.ts               # centavos inteiros, formatação R$
│  │  ├─ identificador.ts          # UUID v7
│  │  ├─ resultado.ts              # tipo Resultado<T, E> se e quando for preciso
│  │  ├─ tipos.ts
│  │  └─ index.ts
│  ├─ ui/                          # componentes visuais genéricos, sem domínio
│  │  ├─ Botao.tsx  Campo.tsx  Folha.tsx  Cartao.tsx ...
│  │  └─ index.ts
│  ├─ i18n/                        # todos os textos visíveis (esp. seção 8)
│  │  ├─ pt-BR/{comum,nucleo,treino,estudos,financas}.ts
│  │  └─ index.ts                  # NOME_DO_APP e o acesso aos textos
│  └─ vite-env.d.ts
├─ eslint.config.js
├─ package.json
├─ playwright.config.ts
├─ tsconfig.json
├─ vite.config.ts
├─ vitest.config.ts
├─ vitest.setup.ts
├─ .prettierrc.json
├─ .prettierignore
└─ .gitattributes
```

Notas sobre a árvore:

1. **`estudos` continua sendo um módulo só**, com `foco/` e `flashcards/` dentro. A seção 5 da especificação lista quatro módulos, e as duas áreas dividem a entidade **matéria/projeto** (sessão de foco, prazo e tópico de flashcard apontam para a mesma matéria). Separar em dois módulos criaria uma dependência cruzada permanente entre eles ou uma matéria duplicada. Cada área tem sua própria pasta, então o ganho prático de dois módulos (separação visual e de responsabilidade) continua existindo.
2. **`src/app/` não é um módulo de domínio**: é a casca (boot, rotas, provedores, layout, registro dos módulos). A tela Hoje e a de Configurações pertencem ao `nucleo`, como manda a especificação 6.4.
3. **`src/persistencia/` é infraestrutura**, não domínio. Guarda o Dexie, as migrações e o tipo base dos registros. Só as pastas `repositorio/` podem importar daqui.
4. **Testes unitários ficam ao lado do código** (`sugestao-de-carga.ts` + `sugestao-de-carga.test.ts`). Testes de migração ficam em `src/persistencia/migracoes/*.test.ts`. E2e fica em `/e2e`.
5. Pastas só nascem quando a fase correspondente começa. O item 0.2 cria `app/`, `persistencia/`, `modulos/nucleo/`, `compartilhado/`, `ui/`, `i18n/` e os `index.ts` vazios-porém-válidos de `treino`, `estudos` e `financas` (cada um exportando ao menos o seu `contratoDeDados`, ainda sem tabelas).

### 2. Convenção de nomes

**Idioma.** Domínio em **português sem acento**; termos técnicos e de framework em **inglês**. A própria especificação já mistura assim (`orcamentoMes`, `metaSemanal`, `capacidadeDiaria` ao lado de `deletedAt`). Regra prática:

- Entidades, campos de negócio, funções de regra, pastas e nomes de arquivo: pt-BR (`SessaoDeFoco`, `calcularRiscoDePrazo`, `sugestao-de-carga.ts`).
- Campos de controle de todo registro, padronizados em inglês: `id`, `createdAt`, `updatedAt`, `deletedAt`.
- Vocabulário de framework em inglês: `props`, `useEffect`, `onClick`, `ref`, hooks `useAlgumaCoisa`.

**ASCII em nomes de arquivo, pasta e identificador.** Nada de acento ou `ç` (`financas`, `sessao`, `exercicio`). O acento vive dentro das strings, e as strings ficam em `src/i18n/`. Motivo: o projeto é desenvolvido no Windows e os nomes atravessam git, Playwright e Cloudflare Pages.

**Formato:**

| Coisa | Convenção | Exemplo |
|---|---|---|
| Pasta | kebab-case, minúscula | `modulos/financas/repositorio` |
| Arquivo de código não-componente | kebab-case | `disponivel-para-hoje.ts` |
| Componente e tela React | PascalCase, extensão `.tsx` | `CartaoDeTreino.tsx`, `Hoje.tsx` |
| Teste unitário | mesmo nome + `.test.ts(x)` | `disponivel-para-hoje.test.ts` |
| Teste e2e | kebab-case + `.spec.ts` | `registrar-gasto.spec.ts` |
| Tipo, interface, classe | PascalCase, **sem prefixo `I`** | `Exercicio`, `ContratoDeDadosDeModulo` |
| Função, variável | camelCase | `calcularDisponivelParaHoje` |
| Constante de módulo | SCREAMING_SNAKE_CASE | `NOME_DO_APP`, `INCREMENTO_PADRAO_KG` |
| Tabela do Dexie | camelCase plural pt-BR | `sessoesDeFoco`, `lancamentos` |
| Chave de tradução | caminho pontuado | `treino.hoje.tituloDoCartao` |

**Proibido `enum`** (o `tsconfig` usa `erasableSyntaxOnly`): use união de literais (`type Avaliacao = 'focada' | 'dispersa'`), que serializa direto para JSON no backup.

### 3. Interfaces públicas (o `index.ts` de cada módulo)

Um módulo só existe para quem está fora através do seu `index.ts`. O `index.ts` reexporta, no máximo:

1. **Tipos das entidades** do módulo (`export type { Exercicio, Serie }`).
2. **Funções de regra pura** que outros precisem (raro; a maioria é interna).
3. **Hooks de leitura** (`useTreinoDeHoje`), que embrulham `useLiveQuery` sobre o repositório.
4. **Comandos de escrita** (`registrarSerie(dados): Promise<void>`).
5. **`cartaoDeHoje`**: o cartão do pilar na tela Hoje (D4).
6. **`contratoDeDados`**: como o módulo entra no backup (princípio 3, item 0.6).

Os dois últimos são contratos definidos em `src/modulos/nucleo/tipos.ts` e implementados por cada pilar. Assinatura fechada agora para que as fases seguintes não inventem cada uma a sua:

```ts
// src/modulos/nucleo/tipos.ts
import type { ComponentType } from 'react';

export type IdDeModulo = 'nucleo' | 'treino' | 'estudos' | 'financas';

/** O cartão que o módulo mostra na tela Hoje. */
export interface CartaoDeHoje {
  readonly modulo: IdDeModulo;
  readonly ordem: number;            // posição na Hoje; menor aparece antes
  readonly Componente: ComponentType; // lê seus próprios dados por hook
}

export interface ArquivoCsv {
  readonly nome: string;             // ex.: 'treino-series.csv'
  readonly conteudo: string;
}

/** Como o módulo participa de exportar, importar e apagar tudo. */
export interface ContratoDeDadosDeModulo {
  readonly modulo: IdDeModulo;
  /** Uma chave por tabela, com todos os registros (inclusive os soft-deleted). */
  exportarJson(): Promise<Record<string, readonly unknown[]>>;
  /** Substitui os dados do módulo. Roda dentro de uma transação do chamador. */
  importarJson(dados: Record<string, readonly unknown[]>): Promise<void>;
  exportarCsv(): Promise<readonly ArquivoCsv[]>;
  apagarTudo(): Promise<void>;
}
```

`src/app/modulos.ts` é o único lugar que conhece todos os módulos:

```ts
// src/app/modulos.ts
import * as nucleo from '@/modulos/nucleo';
import * as treino from '@/modulos/treino';
import * as estudos from '@/modulos/estudos';
import * as financas from '@/modulos/financas';

export const cartoesDaHoje = [nucleo.cartaoDeHoje, treino.cartaoDeHoje, estudos.cartaoDeHoje, financas.cartaoDeHoje];
export const contratosDeDados = [nucleo.contratoDeDados, treino.contratoDeDados, estudos.contratoDeDados, financas.contratoDeDados];
```

Consequência que interessa: **o núcleo nunca importa um pilar**. A Hoje recebe `cartoesDaHoje` por props e o backup recebe `contratosDeDados` por parâmetro. Cada fase acrescenta o seu pilar mudando duas linhas aqui, e o export/import passa a cobrir o módulo novo automaticamente (Definition of Done: "está coberta pela exportação e importação de backup").

Onde mora cada peça sensível:

| Assunto | Lugar |
|---|---|
| Exportar JSON completo, importar backup, apagar tudo | `src/modulos/nucleo/dominio/backup/` + `repositorio/backup.ts` + tela `nucleo/telas/Dados.tsx` |
| CSV por módulo | serialização em cada módulo (`contratoDeDados.exportarCsv`), orquestração no núcleo |
| Schema e migrações | `src/persistencia/migracoes/` |
| Configurações (metas, orçamento, unidades, tema) | `src/modulos/nucleo/dominio/configuracoes.ts` + repositório; **nenhuma regra usa valor fixo** (D4) |
| Histórico de ações / XP | `nucleo/dominio/historico.ts`, `nucleo/dominio/xp.ts` |

### 4. Regra de import entre módulos

Matriz permitida (⬤ pode importar, — não pode):

| de ↓ / para → | app | nucleo | pilares | persistencia | ui | i18n | compartilhado |
|---|---|---|---|---|---|---|---|
| `app` | – | ⬤ | ⬤ | — | ⬤ | ⬤ | ⬤ |
| `nucleo` | — | – | **—** | ⬤ (só `repositorio/`) | ⬤ (só `telas/`, `componentes/`) | ⬤ | ⬤ |
| pilar (`treino`, `estudos`, `financas`) | — | ⬤ | **—** (outro pilar) | ⬤ (só `repositorio/`) | ⬤ (só `telas/`, `componentes/`) | ⬤ | ⬤ |
| `persistencia` | — | — | — | – | — | — | ⬤ |
| `ui` | — | — | — | — | – | ⬤ | ⬤ |
| `i18n` | — | — | — | — | — | – | ⬤ |
| `compartilhado` | — | — | — | — | — | — | – |

Quatro regras verificadas pelo lint:

1. **Import profundo é proibido.** De fora, só `@/modulos/treino`, `@/modulos/nucleo`, `@/persistencia`, `@/ui`, `@/i18n`, `@/compartilhado` — nunca `@/modulos/treino/dominio/x`.
2. **Import relativo não sai do módulo.** Dentro do módulo, sempre relativo (`./`, `../`); para fora, sempre alias `@/`.
3. **Pilar não importa pilar, e o núcleo não importa pilar.**
4. **Tela não toca no banco.** `src/**/telas/**`, `src/**/componentes/**`, `src/ui/**` e `src/app/**` não podem importar `dexie`, `dexie-react-hooks` nem `@/persistencia`. O acesso a dados acontece pelos hooks e comandos do `index.ts` do módulo. O único arquivo do agente `dominio` que importa React é `repositorio/hooks.ts` (invólucros de três linhas sobre `useLiveQuery`).

Divisão de propriedade entre agentes:

| Agente | Pode editar |
|---|---|
| `dominio` | `src/persistencia/**`, `src/modulos/*/dominio/**`, `src/modulos/*/repositorio/**`, `src/compartilhado/**`, `src/modulos/*/index.ts`, `src/modulos/nucleo/tipos.ts` |
| `interface` | `src/app/**`, `src/ui/**`, `src/i18n/**`, `src/modulos/*/telas/**`, `src/modulos/*/componentes/**`, `public/**` |
| `testador` | `e2e/**`, `*.test.ts(x)`, `vitest.setup.ts` |

### 5. Arquivos de configuração (conteúdo exato)

#### `package.json`

Sem versões escritas à mão: o `dominio` instala com os comandos abaixo e mantém as faixas que o npm gravar. As restrições duras estão logo depois.

```json
{
  "name": "app-rotina",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 4173",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:prints": "playwright test prints --project=iphone-webkit",
    "verificar": "npm run lint && npm run format:check && npm run typecheck && npm run test:unit && npm run build"
  }
}
```

Instalação:

```
npm install react react-dom react-router dexie dexie-react-hooks zustand
npm install -D typescript@~6.0 @types/node @types/react @types/react-dom \
  vite @vitejs/plugin-react vite-plugin-pwa \
  vitest jsdom fake-indexeddb \
  @playwright/test @axe-core/playwright \
  eslint @eslint/js globals typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh eslint-config-prettier \
  prettier
npx playwright install --with-deps webkit chromium
```

Restrições duras (se o npm resolver algo fora disso, pare e avise):

- `typescript` **`~6.0`** — TS 7 quebra o lint com informação de tipos (ver Contexto).
- `vite-plugin-pwa` **>= 1.3.0** — é a primeira versão que aceita Vite 8.
- `eslint` `^9` (ou `^10`, se todos os plugins aceitarem).
- **Proibido** instalar `dexie-cloud-addon` (ADR 0001) e qualquer pacote que faça requisição de rede em tempo de execução.
- `ts-fsrs` e `sql.js`/`fflate` só entram na Fase 3.
- `@testing-library/react` + `@testing-library/user-event` entram no item 0.4, com o `testador`.

#### `tsconfig.json`

Um arquivo só, cobrindo `src`, `e2e` e os arquivos de configuração. O TS 6.0 mudou defaults (`strict: true`, `module: esnext`, `target: es2025`, `types: []`) e removeu `baseUrl`, `moduleResolution: node` e `target: es5`; o arquivo abaixo já considera isso e escreve o que importa de forma explícita.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "types": ["vite/client", "node"],
    "paths": { "@/*": ["./src/*"] },

    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noPropertyAccessFromIndexSignature": true,
    "useUnknownInCatchVariables": true
  },
  "include": ["src", "e2e", "*.config.ts", "vitest.setup.ts"]
}
```

- `target: ES2022` (e não o `es2025` padrão do TS 6): o alvo é um iPhone que pode estar em iOS antigo.
- `exactOptionalPropertyTypes` obriga a escrever `deletedAt: string | null` em vez de `deletedAt?: string`. É o que queremos no soft delete: o campo existe sempre e vai inteiro para o JSON do backup.
- `erasableSyntaxOnly` bane `enum`, `namespace` e parâmetros-propriedade — sintaxe que o esbuild não apaga sozinho.

#### `eslint.config.js` (flat config)

```js
// eslint.config.js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier/flat';

/** Fora do módulo, só o index público. */
const importProfundo = {
  group: ['@/modulos/*/*', '@/persistencia/*', '@/compartilhado/*', '@/ui/*', '@/i18n/*', '@/app/*'],
  message: 'Importe só a interface pública do módulo (ex.: "@/modulos/treino"), nunca um arquivo interno dele.',
};

/** Import relativo que escapa do próprio módulo. */
const relativoQueEscapa = {
  regex: '^(\\.\\./)+(app|ui|i18n|modulos|persistencia|compartilhado|nucleo|treino|estudos|financas)(/|$)',
  message: 'Para sair do módulo use o alias "@/...", e só o index público.',
};

const semBanco = {
  group: ['dexie', 'dexie-react-hooks', '@/persistencia', '@/persistencia/*'],
  message: 'Tela e componente nao acessam o banco. Use os hooks e comandos exportados pelo index do modulo.',
};

const pilar = (nome) => ({
  group: [`@/modulos/${nome}`, `@/modulos/${nome}/*`],
  message: `Um pilar nao importa outro pilar (${nome}). Se o dado e comum, ele pertence ao nucleo.`,
});

/** Cada override precisa repetir as regras base: no flat config, a ultima definicao da regra vence. */
const restringirImports = (...extras) => [
  'error',
  { patterns: [importProfundo, relativoQueEscapa, ...extras] },
];

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'test-results', 'playwright-report', 'node_modules'] },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'separate-type-imports' }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],

      'no-restricted-imports': restringirImports(),
    },
  },

  // Nucleo nao conhece os pilares.
  {
    files: ['src/modulos/nucleo/**'],
    rules: { 'no-restricted-imports': restringirImports(pilar('treino'), pilar('estudos'), pilar('financas')) },
  },
  { files: ['src/modulos/treino/**'], rules: { 'no-restricted-imports': restringirImports(pilar('estudos'), pilar('financas')) } },
  { files: ['src/modulos/estudos/**'], rules: { 'no-restricted-imports': restringirImports(pilar('treino'), pilar('financas')) } },
  { files: ['src/modulos/financas/**'], rules: { 'no-restricted-imports': restringirImports(pilar('treino'), pilar('estudos')) } },

  // Camada de apresentacao nao toca no banco.
  {
    files: ['src/app/**', 'src/ui/**', 'src/modulos/*/telas/**', 'src/modulos/*/**/telas/**', 'src/modulos/*/componentes/**', 'src/modulos/*/**/componentes/**'],
    rules: { 'no-restricted-imports': restringirImports(semBanco) },
  },

  // Dominio e compartilhado sao puros: nada de React nem de DOM.
  {
    files: ['src/modulos/*/dominio/**', 'src/modulos/*/**/dominio/**', 'src/compartilhado/**'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': restringirImports(
        { group: ['react', 'react-dom', 'react-router', '@/ui', '@/ui/*', 'dexie', 'dexie-react-hooks'], message: 'Regra de dominio e funcao pura: sem React e sem banco.' },
      ),
    },
  },

  // Configuracao e testes rodam em Node.
  {
    files: ['*.config.ts', 'vitest.setup.ts', 'e2e/**'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-imports': 'off', 'no-console': 'off' },
  },
  { files: ['**/*.test.ts', '**/*.test.tsx'], rules: { '@typescript-eslint/no-non-null-assertion': 'off' } },

  prettier,
);
```

Se a versão instalada do `eslint-plugin-react-hooks` expuser a config por outro caminho (`configs['recommended-latest']` ou `configs.flat.recommended`), ajuste apenas essa linha; o critério é `npm run lint` terminar limpo.

#### `.prettierrc.json`

```json
{
  "semi": true,
  "singleQuote": true,
  "jsxSingleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

#### `.prettierignore`

```
dist
dev-dist
coverage
test-results
playwright-report
docs/prints
package-lock.json
```

**Desvio registrado na implementação (item 0.2):** acrescentadas `.claude/`, `CLAUDE.md`, `README.md`, `docs/*.md`, `docs/adr/`, `setup.mjs`, `scripts/` — arquivos de orquestração e documentação que já existiam com formatação própria, anteriores a este ADR e fora do escopo do app em `src/`. Revisado e aprovado pelo `revisor` no item 0.2.

#### `.gitattributes` (obrigatório: o desenvolvimento é no Windows e o CI é Linux)

```
* text=auto eol=lf
*.png binary
```

#### Acrescentar ao `.gitignore`

```
dev-dist/
test-results/
playwright-report/
.playwright/
*.tsbuildinfo
```

#### `vite.config.ts`

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      devOptions: { enabled: false },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      manifest: {
        id: '/',
        name: '[NOME DO APP]',
        short_name: '[NOME DO APP]',
        description: 'Estudos, financas e treino no seu dispositivo.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#111111',
        theme_color: '#111111',
        icons: [
          { src: '/icones/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icones/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: { sourcemap: true },
  server: { port: 5173 },
  preview: { port: 4173 },
});
```

Os ícones e as cores definitivas chegam no item 0.7 com o agente `interface`; o nome do app sai do placeholder quando o usuário decidir. `registerType: 'prompt'` (e não `autoUpdate`) para nenhuma atualização recarregar a página no meio de um treino ou de um lançamento — reavaliar no item 0.7.

#### `vitest.config.ts`

```ts
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: { provider: 'v8', reportsDirectory: 'coverage', include: ['src/**/dominio/**', 'src/persistencia/**'] },
  },
});
```

`environment: 'node'` é o padrão porque as regras da seção 7 são puras. Teste que precisa de DOM declara na primeira linha do arquivo:

```ts
// @vitest-environment jsdom
```

#### `vitest.setup.ts`

```ts
import 'fake-indexeddb/auto';
```

#### `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

const PORTA = 4173;
const BASE_URL = `http://localhost:${PORTA}`;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 15'] } },
    { name: 'android-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

- Dois projetos conforme D3. Se `devices['iPhone 15']` não existir na versão instalada, use o descritor de iPhone mais recente disponível e registre qual.
- Teste de service worker/offline roda só em `android-chromium` (pendência 10 do plano), com `test.skip(({ browserName }) => browserName === 'webkit')`.
- **Prints (D6):** `e2e/prints.spec.ts` grava em `docs/prints/fase-${process.env.FASE ?? '0'}/<nome-da-tela>.png` via `page.screenshot({ path, fullPage: true })`, e o arquivo inteiro é pulado fora do projeto `iphone-webkit`. `docs/prints/` fica fora do `.prettierignore`... isto é, é ignorado pelo Prettier, mas **versionado no git** (é o entregável do relatório de fase).

### 6. Critérios de aceite do item 0.2

O `dominio` só declara o item pronto quando todos passarem, na ordem:

1. `npm install` conclui sem `ERESOLVE` e sem aviso de peer dependency; `node --version` >= 22.
2. A árvore da seção 1 existe (pastas das Fases 1 a 4 podem ter só o `index.ts`), com um `.gitkeep` onde ainda não houver arquivo.
3. `npm run typecheck` termina com 0 erro, e o `tsconfig.json` contém, literalmente, todas as flags da seção 5.
4. `npm run lint` termina com 0 erro e 0 aviso.
5. `npm run format:check` passa.
6. `npm run test:unit` roda e passa com pelo menos **dois** testes reais: um de `compartilhado/identificador.ts` (UUID v7 gerado em sequência ordena crescente como string) e um de `compartilhado/dinheiro.ts` (centavos inteiros: `formatarBRL(123456) === 'R$ 1.234,56'`).
7. `npm run build` gera `dist/index.html`, `dist/manifest.webmanifest` e um `sw.js`.
8. `npx playwright test --list` lista os projetos `iphone-webkit` e `android-chromium` sem erro de configuração (os testes em si são do item 0.4).
9. **A fronteira falha o lint.** Criar temporariamente quatro arquivos de violação, rodar `npx eslint`, confirmar erro em cada um e apagá-los. Registrar a saída no relatório:
   - `import { x } from '@/modulos/treino/dominio/serie'` dentro de `src/modulos/financas/` → erro;
   - `import { x } from '../../treino/dominio/serie'` dentro de `src/modulos/financas/` → erro;
   - `import * as treino from '@/modulos/treino'` dentro de `src/modulos/financas/` → erro;
   - `import { db } from '@/persistencia'` dentro de um arquivo em `telas/` → erro.
10. `npm run verificar` roda a cadeia inteira e termina com código 0 (é o que o CI do item 0.3 vai chamar).
11. `npm ls --depth=0` não lista `dexie-cloud-addon` nem nenhuma dependência que faça requisição de rede; nenhum pacote além dos listados na seção 5.
12. `src/modulos/nucleo/tipos.ts` contém, literalmente, os quatro tipos da seção 3 (`IdDeModulo`, `CartaoDeHoje`, `ArquivoCsv`, `ContratoDeDadosDeModulo`), e `src/app/modulos.ts` existe com as duas listas (mesmo que os pilares ainda devolvam contratos vazios).
13. `git status` limpo depois do commit: nada de `node_modules`, `dist`, `test-results` ou `playwright-report` versionado.

### 7. Ajustes em `CLAUDE.md` e `.claude/settings.json`

Não edito esses arquivos; o orquestrador aplica. Texto pronto:

**Seção "Stack":** React 19 + TypeScript 6 (strict) + Vite 8 · Dexie 4 (IndexedDB) + `dexie-react-hooks` · Zustand (estado efêmero) · `vite-plugin-pwa` · React Router · Vitest + `fake-indexeddb` · Playwright (WebKit/iPhone + Chromium/Android) + `@axe-core/playwright` · ESLint 9 (flat) + Prettier · GitHub Actions · Cloudflare Pages. Detalhes em `docs/adr/0001-stack.md` e `docs/adr/0002-estrutura.md`.

**Seção "Comandos":**

- Instalar: `npm install`
- Dev: `npm run dev`
- Testes unitários: `npm run test:unit`
- Testes e2e: `npm run test:e2e` (prints: `npm run test:e2e:prints`)
- Lint e tipos: `npm run lint` e `npm run typecheck`
- Build: `npm run build`
- Tudo de uma vez: `npm run verificar`

**`.claude/settings.json`:** o `allow` atual já cobre a stack (`npm install`, `npm run:*`, `npx playwright:*`, `npx tsc:*`, `npx vitest:*`, `npx eslint:*`, `npx prettier:*`). Acrescente `Bash(npm ls:*)` e `Bash(npx vite:*)`; remova as quatro entradas de `pnpm`, que não serão usadas. O bloco `deny` permanece como está.

## Alternativas consideradas

- **`foco` e `flashcards` como módulos de primeiro nível** (pedido na delegação). Recusado: a seção 5 da especificação lista `estudos` como um módulo, e as duas áreas dividem a entidade matéria/projeto — que também é usada pelos prazos. Dois módulos exigiriam um terceiro só para a matéria, ou uma dependência cruzada permanente. Com `estudos/foco/` e `estudos/flashcards/` a separação de pastas fica igual e o custo some. Reverter é um `git mv`, se o orquestrador preferir o outro formato.
- **`eslint-plugin-boundaries`** (MIT, 7.2.0, mantido, com flat config). Faz exatamente o que a seção 4 pede e resolve import relativo por resolução de caminho, não por regex. Não adotado agora porque o mesmo resultado sai de `no-restricted-imports`, que já vem no ESLint — uma dependência a menos para manter num projeto com 5 fronteiras fixas. **Gatilho de reavaliação:** se aparecer um falso negativo na verificação do critério 9, ou quando a lista de overrides passar de oito blocos, instale o plugin e substitua esta seção.
- **Monorepo com workspaces (um pacote por módulo).** Daria fronteira física garantida, ao custo de build, configuração e tempo de CI multiplicados. Exagero para um app de um usuário.
- **`src/features/` em inglês, plano, sem `modulos/`.** Descartado: a especificação nomeia os módulos em português e a estrutura fica mais fácil de casar com o documento.
- **Testes em `tests/` espelhando `src/`.** Descartado: distância entre regra e teste aumenta a chance de a regra mudar sem o teste mudar junto.
- **TypeScript 7.** É GA e é 10× mais rápido, mas hoje desliga o lint com informação de tipos. Reavaliar quando o `typescript-eslint` publicar suporte ao 7.1 (beta previsto para out/2026); a migração é trocar uma linha do `package.json` e rodar `npm run verificar`.
- **Tailwind / CSS-in-JS.** Fora de escopo aqui. A Fase 0 usa **CSS Modules** (nativo do Vite, zero dependência, zero runtime) com tokens em `src/app/estilos/tokens.css`, que é onde tema claro/escuro e contraste AA vão morar.

## Consequências

- Acrescentar um pilar numa fase nova é: criar `src/modulos/<pilar>/`, exportar `cartaoDeHoje` e `contratoDeDados` no `index.ts` e registrar duas linhas em `src/app/modulos.ts`. A Hoje e o backup passam a cobrir o módulo sem mudança no núcleo — que é o que D4 e o princípio 3 exigem.
- A regra "tela não toca no banco" deixa de ser combinado e vira erro de lint, o que dá ao `revisor` um critério objetivo.
- Todo dado novo precisa entrar em `contratoDeDados`, senão o backup não o cobre. Isso vira item obrigatório do checklist do `revisor-critico`.
- Preço a pagar: um `index.ts` por módulo para manter, e imports relativos dentro do módulo e com alias fora dele (duas convenções em vez de uma). Em troca, a fronteira é verificável.
- O núcleo passa a ter um tipo (`ContratoDeDadosDeModulo`) escrito antes do item 0.6 existir. É deliberado: define desde já como export/import vai crescer.
- `exactOptionalPropertyTypes` e `erasableSyntaxOnly` vão gerar atrito pontual com bibliotecas e com props opcionais de React. Regra: resolver com o tipo correto (`| null`, `| undefined` explícito), nunca com `any`.
- Ficou de fora desta fase: CI (0.3), testes de verdade (0.4), schema e migrações reais (0.5), backup implementado (0.6), manifesto e ícones definitivos (0.7), telas Hoje e Configurações (0.10/0.11).

## Fontes consultadas em 21/09/2026

- typescript-eslint — versões de ESLint e TypeScript suportadas: <https://typescript-eslint.io/users/dependency-versions/>
- TypeScript 6.0 (defaults e opções removidas): <https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/>
- TypeScript 7.0 GA e ausência da API programática: <https://www.infoq.com/news/2026/08/typescript-7-released/>
- `vite-plugin-pwa` 1.3.0 com suporte a Vite 8: <https://github.com/vite-pwa/vite-plugin-pwa/issues/923>
- ESLint `no-restricted-imports` (padrões estilo gitignore e opção `regex`): <https://eslint.org/docs/latest/rules/no-restricted-imports>
- `eslint-plugin-boundaries`: <https://github.com/javierbrea/eslint-plugin-boundaries>
- Vitest 5 / Vite 8 / Playwright 1.63 / React 19.3: notas de versão dos respectivos projetos.
