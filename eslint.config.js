// eslint.config.js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier/flat';

/** Fora do módulo, só o index público. */
const importProfundo = {
  group: [
    '@/modulos/*/*',
    '@/persistencia/*',
    '@/compartilhado/*',
    '@/ui/*',
    '@/i18n/*',
    '@/app/*',
  ],
  message:
    'Importe só a interface pública do módulo (ex.: "@/modulos/treino"), nunca um arquivo interno dele.',
};

/** Import relativo que escapa do próprio módulo. */
const relativoQueEscapa = {
  regex:
    '^(\\.\\./)+(app|ui|i18n|modulos|persistencia|compartilhado|nucleo|treino|estudos|financas)(/|$)',
  message: 'Para sair do módulo use o alias "@/...", e só o index público.',
};

const semBanco = {
  group: ['dexie', 'dexie-react-hooks', '@/persistencia', '@/persistencia/*'],
  message:
    'Tela e componente nao acessam o banco. Use os hooks e comandos exportados pelo index do modulo.',
};

const puroDominio = {
  group: ['react', 'react-dom', 'react-router', '@/ui', '@/ui/*', 'dexie', 'dexie-react-hooks'],
  message: 'Regra de dominio e funcao pura: sem React e sem banco.',
};

const pilar = (nome) => ({
  group: [`@/modulos/${nome}`, `@/modulos/${nome}/*`],
  message: `Um pilar nao importa outro pilar (${nome}). Se o dado e comum, ele pertence ao nucleo.`,
});

/** @typedef {{ group?: string[], regex?: string, message: string }} PadraoRestrito */

/**
 * Cada override precisa repetir as regras base: no flat config, a ultima definicao da regra vence.
 * @param {...PadraoRestrito} extras
 */
const restringirImports = (...extras) => [
  'error',
  { patterns: [importProfundo, relativoQueEscapa, ...extras] },
];

/**
 * Nomes dos pilares que NÃO são o módulo `donoDoModulo` (nucleo nunca importa
 * nenhum pilar; cada pilar não importa os outros dois).
 * @param {string} donoDoModulo
 */
const outrosPilares = (donoDoModulo) =>
  ['treino', 'estudos', 'financas'].filter((nome) => nome !== donoDoModulo).map(pilar);

/**
 * Um bloco por módulo, sempre com a MESMA lista de "outros pilares" nas três
 * variantes (base, domínio puro, apresentação sem banco). Isso evita o bug de
 * composição do flat config: como a última definição de uma regra vence por
 * arquivo, um bloco genérico de "domínio puro" ou "sem banco" declarado depois
 * apagaria a restrição de pilar se ela não fosse repetida aqui.
 * @param {string} nome
 */
const blocosDoModulo = (nome) => {
  const semOutrosPilares = outrosPilares(nome);
  return [
    // Base: repositorio/, index.ts, tipos.ts e qualquer outro arquivo do módulo.
    {
      files: [`src/modulos/${nome}/**`],
      rules: { 'no-restricted-imports': restringirImports(...semOutrosPilares) },
    },
    // Domínio: também não pode ter React nem banco.
    {
      files: [`src/modulos/${nome}/dominio/**`, `src/modulos/${nome}/**/dominio/**`],
      languageOptions: { globals: {} },
      rules: { 'no-restricted-imports': restringirImports(...semOutrosPilares, puroDominio) },
    },
    // Telas e componentes: também não podem tocar no banco.
    {
      files: [
        `src/modulos/${nome}/telas/**`,
        `src/modulos/${nome}/**/telas/**`,
        `src/modulos/${nome}/componentes/**`,
        `src/modulos/${nome}/**/componentes/**`,
      ],
      rules: { 'no-restricted-imports': restringirImports(...semOutrosPilares, semBanco) },
    },
  ];
};

export default tseslint.config(
  {
    // `setup.mjs` e `scripts/**` são ferramentas de orquestração do repositório
    // (fora de src/e2e, criadas antes deste ADR); não são código de aplicação e
    // não entram nas regras de fronteira entre módulos.
    ignores: [
      'dist',
      'dev-dist',
      'coverage',
      'test-results',
      'playwright-report',
      'node_modules',
      'setup.mjs',
      'scripts/**',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
      parserOptions: {
        // `eslint.config.js` fica fora do `tsconfig.json` (que só cobre
        // src/e2e/*.config.ts): usa o projeto default do typescript-eslint.
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],

      'no-restricted-imports': restringirImports(),
    },
  },

  // Nucleo e cada pilar: base + domínio puro + apresentação sem banco, sempre
  // com a restrição de não importar os outros pilares junto (ver comentário
  // de `blocosDoModulo`).
  ...blocosDoModulo('nucleo'),
  ...blocosDoModulo('treino'),
  ...blocosDoModulo('estudos'),
  ...blocosDoModulo('financas'),

  // Casca da aplicação e UI genérica: não tocam no banco. `app/` pode importar
  // os pilares (é o único lugar que pode, ver `src/app/modulos.ts`); `ui/` não
  // tem restrição extra de pilar porque a especificação já a proíbe de
  // qualquer forma via `importProfundo` para imports profundos, e não há tela
  // nem componente dentro de `src/ui/**` hoje.
  {
    files: ['src/app/**', 'src/ui/**'],
    rules: { 'no-restricted-imports': restringirImports(semBanco) },
  },

  // Compartilhado é puro: sem React e sem banco, sem restrição de pilar (não
  // pertence a nenhum).
  {
    files: ['src/compartilhado/**'],
    languageOptions: { globals: {} },
    rules: { 'no-restricted-imports': restringirImports(puroDominio) },
  },

  // Configuracao e testes rodam em Node.
  {
    files: ['*.config.ts', 'vitest.setup.ts', 'e2e/**'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-imports': 'off', 'no-console': 'off' },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },

  prettier,
);
