# 0006. Backup: exportar JSON, CSV por módulo, importar e apagar tudo

- Data: 2026-09-22
- Status: **aceita**. Sem pergunta bloqueante (ver "Pendências"); implementada e aprovada pelo `revisor-critico` em 2026-09-23.

## Contexto

Item 0.6 do `docs/PLANO.md`: "Exportar/importar JSON, CSV por módulo, apagar tudo". É o princípio 3 da especificação ("o usuário é dono dos dados") virando código, e é a primeira funcionalidade da Fase 0 com tela.

O que a especificação exige:

| Onde | Exigência |
|---|---|
| Princípio 3 (seção 3) | Exportação e importação completas em **JSON (backup)** e **CSV (por módulo)** desde a primeira versão; opção de **apagar tudo com confirmação** |
| Seção 6.4 | "Exportar tudo (JSON), exportar por módulo (CSV), importar backup, apagar tudo" na tela de configurações e dados |
| Seção 5 | Um módulo não acessa o armazenamento de outro; regras puras separadas da interface e da persistência; nunca quebrar dados de uma versão anterior |
| Seção 8 | Offline completo; gravações atômicas; **acessibilidade WCAG 2.2 AA** (contraste, teclado, rótulos, alvo de toque 44 × 44 px, `prefers-reduced-motion`); pt-BR com textos centralizados |
| Seção 9 | E2e para os fluxos críticos, **incluindo "exportar e importar backup"**; teste automatizado de acessibilidade nas telas principais |
| Seção 11 | Toda funcionalidade tem de estar "coberta pela exportação e importação de backup" |
| Princípio 6 / `CLAUDE.md` | Nenhuma dependência que envie dados para fora do dispositivo |

O que já existe e não se reabre:

- **ADR 0002, seção 3:** `ContratoDeDadosDeModulo` (`exportarJson`, `importarJson`, `exportarCsv`, `apagarTudo`), `ArquivoCsv` e `IdDeModulo` já estão escritos em `src/modulos/nucleo/tipos.ts`. **Este ADR não muda nenhuma dessas assinaturas** — só as implementa.
- **ADR 0002, seção 3:** `src/app/modulos.ts` agrega `contratosDeDados` dos quatro módulos. O núcleo **nunca** importa um pilar: o backup **recebe `contratosDeDados` por parâmetro**, e a tela recebe a mesma lista **por prop**.
- **ADR 0002, seção 4:** matriz de imports. `dominio/` é puro (sem React, sem DOM, sem Dexie, e **não pode importar `@/persistencia`**); só `repositorio/` fala com o banco; `telas/` e `ui/` não importam `@/persistencia`; `src/compartilhado/**` roda com `languageOptions.globals = {}`, isto é, **sem DOM**.
- **ADR 0005:** `TABELAS` é a lista única de tabelas; `emTransacao` dá atomicidade; todo registro tem `RegistroBase` (`id`, `createdAt`, `updatedAt`, `deletedAt`) e é **JSON puro** (sem `Date`, sem `undefined`, sem classe); soft delete nunca é purgado e **sai no backup**; exclusão física só acontece em `apagarTudo`; `CONFIGURACOES_PADRAO` e `ID_DAS_CONFIGURACOES = 'configuracoes-unicas'`; `obterConfiguracoes()` devolve o padrão sem gravar, então **sem linha de configuração o app está no estado de primeiro uso** (`onboardingConcluidoEm === null`).
- **ADR 0005, seção 10:** o `contratoDeDados` real do núcleo é escopo deste item. Hoje `src/modulos/nucleo/index.ts` devolve estruturas vazias com um comentário desatualizado ("o núcleo ainda não tem tabelas próprias") — as duas tabelas existem desde o item 0.5 e o comentário some aqui.
- **Estado dos pilares:** `treino`, `estudos` e `financas` seguem sem tabela até a fase deles. Continuam devolvendo vazio (com um ajuste de segurança na seção 5.4).

Três fatos técnicos verificados em 22/09/2026 que mudam o desenho (fontes ao fim):

1. **No iPhone, `<a download>` não é confiável dentro de um PWA instalado.** O Safari ignora o atributo `download` em modo standalone; o caminho que funciona é a **Web Share API com arquivo** (`navigator.canShare({ files })` → `navigator.share({ files })`), que abre a folha de compartilhamento nativa e deixa o usuário salvar em Arquivos. O `<a download>` continua sendo o caminho certo no navegador comum e no desktop.
2. **`navigator.share` exige ativação transitória, e no WebKit ela dura ~5 s e é consumida por `await`.** Montar o arquivo depois do toque e só então chamar `share()` pode falhar com `NotAllowedError`. A saída é montar o conteúdo antes de chamar `share()` e, se ainda assim falhar, oferecer um **botão visível "Salvar arquivo"** que reexecuta o salvamento num toque novo, com o conteúdo já em memória.
3. **`showSaveFilePicker` (File System Access API) não existe no Safari** (nem no Firefox) — só o sistema de arquivos privado da origem, que não serve para entregar arquivo ao usuário. Está fora de consideração.

Nenhum dos três exige dependência nova: `Blob`, `URL.createObjectURL`, `<a download>`, `navigator.share`, `<input type="file">` e `File.text()` são APIs do navegador.

## Decisão

### 1. Formato do arquivo de backup JSON

Duas versões independentes no envelope, porque elas mudam por motivos diferentes:

- **`versaoDoFormato`** — a forma do envelope (metadados + módulos). Muda se o envelope mudar. Começa em `1`.
- **`versaoDoSchema`** — a versão do schema do banco (`VERSAO_DO_SCHEMA`, ADR 0005), que descreve a forma **dos registros** de dentro. Hoje `1`; sobe a cada migração.

```ts
// src/modulos/nucleo/dominio/backup/formato.ts   (puro)
export const FORMATO_DO_BACKUP = 'app-rotina-backup';
export const VERSAO_DO_FORMATO_DE_BACKUP = 1;

/**
 * So identificacao tecnica e instante. NUNCA modelo do aparelho, user agent,
 * fuso, nome de usuario ou qualquer dado de identificacao (principios 1 e 5).
 */
export interface MetadadosDoBackup {
  readonly formato: typeof FORMATO_DO_BACKUP;
  readonly versaoDoFormato: number;
  readonly versaoDoSchema: number;
  /** Instante ISO em UTC (`agoraEmIso()`). */
  readonly geradoEm: string;
}

/** Uma chave por tabela do modulo, com TODOS os registros (inclusive soft-deleted). */
export type DadosDeModulo = Readonly<Record<string, readonly unknown[]>>;

export interface ArquivoDeBackup {
  readonly metadados: MetadadosDoBackup;
  /** Uma chave por modulo. A exportacao escreve as quatro, mesmo vazias. */
  readonly modulos: Readonly<Partial<Record<IdDeModulo, DadosDeModulo>>>;
}
```

Exemplo do arquivo gerado hoje (núcleo com uma configuração e uma ação; pilares vazios):

```json
{
  "metadados": {
    "formato": "app-rotina-backup",
    "versaoDoFormato": 1,
    "versaoDoSchema": 1,
    "geradoEm": "2026-09-22T18:04:05.123Z"
  },
  "modulos": {
    "nucleo": {
      "configuracoes": [
        {
          "id": "configuracoes-unicas",
          "createdAt": "2026-09-22T17:00:00.000Z",
          "updatedAt": "2026-09-22T17:00:00.000Z",
          "deletedAt": null,
          "metaSemanalDeFocoEmMinutos": 600,
          "metaSemanalDeTreinos": 3,
          "orcamentoMensalEmCentavos": null,
          "unidadeDePeso": "kg",
          "tema": "sistema",
          "onboardingConcluidoEm": null
        }
      ],
      "historicoDeAcoes": [
        {
          "id": "0192f0c3-...",
          "createdAt": "2026-09-22T17:00:00.000Z",
          "updatedAt": "2026-09-22T17:00:00.000Z",
          "deletedAt": null,
          "tipo": "nucleo.configuracoesSalvas",
          "modulo": "nucleo",
          "ocorridaEm": "2026-09-22T17:00:00.000Z",
          "dia": "2026-09-22",
          "referenciaId": null,
          "quantidade": null
        }
      ]
    },
    "treino": {},
    "estudos": {},
    "financas": {}
  }
}
```

Regras do formato, válidas para todas as fases:

1. **O backup é completo e literal.** Todo registro de toda tabela, **inclusive os soft-deleted**, com `id`, `createdAt`, `updatedAt` e `deletedAt` exatamente como estão no banco. Nada é recalculado, nada é resumido, nada é omitido. XP e níveis não entram no arquivo: são derivados do histórico (D5).
2. **Cada tabela sai ordenada por `id` crescente.** `id` é UUID v7, logo a ordem é cronológica e o arquivo é **determinístico**: exportar duas vezes o mesmo banco produz bytes idênticos, exceto `geradoEm`. É o que torna o teste de ida e volta uma comparação de igualdade.
3. **Serialização:** `JSON.stringify(arquivo, null, 2)` + `\n` final, UTF-8 sem BOM, MIME `application/json`. Indentado de propósito: é um arquivo que o usuário pode abrir e ler, e o custo em bytes é irrelevante para o volume de um usuário.
4. **A chave de módulo é `IdDeModulo`**; a chave dentro do módulo é o **nome da tabela do Dexie** (`TABELAS`, ADR 0005). Quem conhece os nomes de tabela de um módulo é só aquele módulo.
5. **Nome do arquivo:** `app-rotina-backup-AAAA-MM-DD.json` (data de calendário local). O prefixo `app-rotina` é o mesmo identificador técnico já usado no banco (`app-rotina-db`, D12) e **não é o nome do produto**, que ainda é placeholder (pendência 8/9). Trocar o prefixo depois é mudar uma constante: a importação **nunca** depende do nome do arquivo, só do conteúdo.

### 2. Contrato do domínio — `src/modulos/nucleo/dominio/backup/`

Tudo aqui é função pura: sem relógio, sem banco, sem DOM, sem React. Quem tem relógio e banco é o repositório (seção 4).

#### 2.1 `formato.ts`

Os tipos e constantes da seção 1, mais o resumo que a tela usa para explicar o arquivo antes de importar:

```ts
export interface ResumoDeTabela { readonly tabela: string; readonly registros: number }
export interface ResumoDeModulo {
  readonly modulo: IdDeModulo;
  readonly tabelas: readonly ResumoDeTabela[];
  readonly registros: number;
}
export interface ResumoDoBackup {
  readonly geradoEm: string;
  readonly versaoDoSchema: number;
  readonly registros: number;
  readonly modulos: readonly ResumoDeModulo[];   // so modulos com pelo menos 1 registro
}

/** Contagens, nada de conteudo. Serve para a confirmacao da importacao. */
export function resumirBackup(arquivo: ArquivoDeBackup): ResumoDoBackup;
```

#### 2.2 `erros.ts`

```ts
export type CodigoDeErroDeBackup =
  | 'jsonInvalido'            // JSON.parse falhou
  | 'naoEhBackup'             // sem envelope, ou metadados.formato diferente
  | 'formatoMaisNovo'         // versaoDoFormato > VERSAO_DO_FORMATO_DE_BACKUP
  | 'formatoMaisAntigo'       // versaoDoFormato < VERSAO_DO_FORMATO_DE_BACKUP
  | 'schemaMaisNovo'          // versaoDoSchema > VERSAO_DO_SCHEMA do app
  | 'schemaMaisAntigo'        // versaoDoSchema < VERSAO_DO_SCHEMA do app
  | 'moduloDesconhecido'      // chave de modulo fora de IdDeModulo
  | 'estruturaInvalida'       // modulos/tabela nao e objeto/array
  | 'registroInvalido';       // registro sem a forma de RegistroBase ou invalido para a tabela

/**
 * Erro unico de todo o caminho de backup: a leitura pura devolve uma instancia
 * dentro de `LeituraDeBackup`, e as implementacoes de `importarJson` a LANCAM
 * (o que desfaz a transacao inteira, secao 5).
 *
 * `detalhe` e texto de desenvolvedor e pode citar nome de modulo, de tabela, de
 * campo e indice na lista — NUNCA o valor de um campo do usuario. E exibido num
 * bloco "detalhes tecnicos" da tela, e essa regra e o que torna isso seguro.
 */
export class ErroDeBackup extends Error {
  readonly codigo: CodigoDeErroDeBackup;
  readonly detalhe: string;
  constructor(codigo: CodigoDeErroDeBackup, detalhe: string);
}

export function ehErroDeBackup(erro: unknown): erro is ErroDeBackup;
```

#### 2.3 `json.ts`

```ts
/** Monta o envelope. `geradoEm` e `versaoDoSchema` vem de fora: funcao pura. */
export function montarBackup(entrada: {
  readonly geradoEm: string;
  readonly versaoDoSchema: number;
  readonly modulos: Readonly<Partial<Record<IdDeModulo, DadosDeModulo>>>;
}): ArquivoDeBackup;

export function serializarBackup(arquivo: ArquivoDeBackup): string;

export type LeituraDeBackup =
  | { readonly ok: true; readonly arquivo: ArquivoDeBackup }
  | { readonly ok: false; readonly erro: ErroDeBackup };

/**
 * Parse + validacao do envelope. NAO toca no banco e NAO valida campo de
 * negocio (isso e de cada modulo, secao 5.2). `versaoDoSchemaAtual` entra por
 * parametro porque `dominio/` nao pode importar `@/persistencia`.
 */
export function lerBackup(texto: string, versaoDoSchemaAtual: number): LeituraDeBackup;

/** Forma minima exigida de todo registro, espelho de `RegistroBase`. */
export interface RegistroDoBackup {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}
export function validarRegistrosDaTabela(
  modulo: IdDeModulo,
  tabela: string,
  valor: unknown,
): readonly RegistroDoBackup[];   // lanca ErroDeBackup se reprovar
```

`RegistroDoBackup` duplica os quatro campos de `RegistroBase` porque a matriz de imports proíbe o domínio de importar `@/persistencia`. A duplicação é mantida honesta por uma prova de compatibilidade em `repositorio/backup.ts` (que pode importar os dois):

```ts
/** Falha a compilacao se `RegistroBase` deixar de satisfazer `RegistroDoBackup`. */
export const PROVA_DE_COMPATIBILIDADE: RegistroBase extends RegistroDoBackup ? true : never = true;
```

O que `lerBackup` verifica, em ordem (primeiro erro encontrado encerra):

1. `JSON.parse` → `jsonInvalido`.
2. Raiz é objeto, tem `metadados` objeto e `modulos` objeto; `metadados.formato === FORMATO_DO_BACKUP` → senão `naoEhBackup`.
3. `versaoDoFormato` inteiro e igual a `VERSAO_DO_FORMATO_DE_BACKUP` → senão `formatoMaisNovo` / `formatoMaisAntigo`.
4. `versaoDoSchema` inteiro e **igual** a `versaoDoSchemaAtual` → senão `schemaMaisNovo` / `schemaMaisAntigo`. Ver seção 5.3 para o motivo de bloquear e o que muda quando a v2 do schema existir.
5. `metadados.geradoEm` é instante ISO com componente de hora (mesmo critério de `validarInstante` em `@/compartilhado`) → senão `naoEhBackup`.
6. Toda chave de `modulos` pertence a `IdDeModulo` → senão `moduloDesconhecido`.
7. Cada valor de módulo é objeto e cada valor de tabela é array → senão `estruturaInvalida`.
8. Cada item de cada array tem a forma de `RegistroDoBackup` (`id` string não vazia; `createdAt`/`updatedAt` instantes ISO; `deletedAt` `null` ou instante ISO) → senão `registroInvalido`. `id` duplicado dentro da mesma tabela também é `registroInvalido` (senão o `bulkPut` engoliria um registro em silêncio).

#### 2.4 `csv.ts`

```ts
export interface ColunaCsv<T> {
  /** Cabecalho = nome tecnico do campo, igual a chave do JSON (`ocorridaEm`). */
  readonly titulo: string;
  readonly valor: (registro: T) => string | number | null;
}

/** RFC 4180 adaptado: separador `;`, CRLF, BOM. Ver regras abaixo. */
export function montarCsv<T>(colunas: readonly ColunaCsv<T>[], registros: readonly T[]): string;
```

#### 2.5 `nomes.ts`

```ts
/** Identificador tecnico, NAO o nome do produto (placeholder, pendencia 8/9). */
export const PREFIXO_DOS_ARQUIVOS = 'app-rotina';

/** `dia` em `AAAA-MM-DD` → `app-rotina-backup-2026-09-22.json`. */
export function nomeDoArquivoDeBackup(dia: string): string;

/** `('nucleo-historico-de-acoes.csv', '2026-09-22')` → `nucleo-historico-de-acoes-2026-09-22.csv`. */
export function nomeDoArquivoCsv(nomeBase: string, dia: string): string;
```

`src/modulos/nucleo/dominio/backup/index.ts` reexporta o que sai da pasta. O `index.ts` do módulo (seção 4.4) reexporta para fora apenas o que a tela e os pilares consomem.

### 3. CSV por módulo

A especificação pede CSV "por módulo" e não diz mais nada. Decisões:

1. **Um arquivo por tabela, agrupado por módulo.** `exportarCsv()` de cada módulo devolve `readonly ArquivoCsv[]`; a tela mostra uma seção por módulo com um botão de salvar **por arquivo**. Nada de zip (dependência nova) e nada de disparar vários downloads de uma vez (o navegador bloqueia o segundo).
2. **Nome:** `<modulo>-<assunto-em-kebab-case>.csv`, no formato que o ADR 0002 já usava de exemplo (`treino-series.csv`). O `ArquivoCsv.nome` é o nome estável, **sem data**; a data entra na hora de salvar, via `nomeDoArquivoCsv` (seção 2.5). Hoje existem dois: `nucleo-configuracoes.csv` e `nucleo-historico-de-acoes.csv`.
3. **Só linhas ativas** (`apenasAtivos`). Diferente do JSON, que leva tudo. Motivo concreto: o CSV existe para ser aberto numa planilha, e uma linha excluída misturada às ativas faz o usuário somar gasto apagado (Fase 4) sem perceber a coluna `deletedAt`. Quem quer o dado completo usa o JSON — e o JSON é o único caminho de restauração.
4. **Colunas declaradas explicitamente** por tabela, começando por `id`, com o **nome técnico do campo** no cabeçalho (igual à chave do JSON). Sem serialização automática de "todos os campos": campo novo só aparece no CSV se a entrega que o criou escolher a coluna.
   - `nucleo-configuracoes.csv`: `id;createdAt;updatedAt;metaSemanalDeFocoEmMinutos;metaSemanalDeTreinos;orcamentoMensalEmCentavos;unidadeDePeso;tema;onboardingConcluidoEm`
   - `nucleo-historico-de-acoes.csv`: `id;createdAt;ocorridaEm;dia;modulo;tipo;quantidade;referenciaId`
5. **Valores canônicos, com a unidade no nome da coluna** (`orcamentoMensalEmCentavos`, `metaSemanalDeFocoEmMinutos`, e na Fase 1 `pesoEmGramas`). O CSV é exportação de dado, não relatório: nenhuma conversão para reais nem para kg, nenhum separador de milhar, nenhuma vírgula decimal. Isso mantém o arquivo legível por planilha **e** por script, e evita reintroduzir ponto flutuante.
6. **Separador `;`, fim de linha `CRLF`, UTF-8 com BOM.** Motivo: o Excel em pt-BR usa `;` como separador de lista; com `,` o arquivo abre todo na coluna A, e sem BOM os acentos saem corrompidos. Como a importação **não lê CSV**, essa escolha não tem efeito nenhum sobre integridade de dado — é só ergonomia, e é uma constante (`SEPARADOR_CSV`) se um dia mudar.
7. **Escape:** campo é envolvido em `"` quando contém `;`, `"`, CR ou LF, e o `"` interno é dobrado. `null` vira campo vazio. Números saem sem formatação.
8. **Proteção contra fórmula em planilha:** valor **de texto** que começa com `=`, `+`, `-`, `@`, TAB ou CR é escrito entre aspas e prefixado com `'`. Não é paranoia: a partir da Fase 3 o app importa baralhos do Anki, isto é, texto de terceiros, que depois sai no CSV e seria executado pelo Excel do usuário. A regra vale só para texto — número continua número, então valor negativo não é afetado.

### 4. Repositório e orquestração

#### 4.1 Uma transação de leitura em `src/persistencia/`

O ADR 0005, seção 5, deixou a variante de leitura para "quando o item 0.6 precisar". Precisa: exportar quatro módulos com quatro leituras soltas pode capturar meio treino gravado no meio do caminho. Acrescenta-se **uma** função e a exportação dela no `index.ts` da camada:

```ts
// src/persistencia/transacao.ts
/**
 * Snapshot consistente para exportar. Modo 'r': tentar gravar dentro dela
 * rejeita, o que e desejado — exportar nao escreve.
 */
export function emTransacaoDeLeitura<T>(
  tabelas: readonly NomeDeTabela[],
  operacao: () => Promise<T>,
): Promise<T>;
```

#### 4.2 `src/modulos/nucleo/repositorio/backup.ts` — o orquestrador

```ts
export interface ResultadoDaImportacao {
  readonly resumo: ResumoDoBackup;
  readonly registrosImportados: number;
}

/** Le TODAS as tabelas numa transacao de leitura e monta o envelope. */
export function exportarBackup(
  contratos: readonly ContratoDeDadosDeModulo[],
): Promise<ArquivoDeBackup>;

export interface CsvsDeModulo {
  readonly modulo: IdDeModulo;
  readonly arquivos: readonly ArquivoCsv[];   // vazio = modulo sem dado
}
export function exportarCsvPorModulo(
  contratos: readonly ContratoDeDadosDeModulo[],
): Promise<readonly CsvsDeModulo[]>;

/**
 * SUBSTITUI o banco inteiro pelo conteudo do arquivo, numa unica transacao
 * sobre TABELAS. Chama `importarJson` de TODOS os contratos registrados,
 * inclusive dos modulos ausentes do arquivo (com `{}`), para que importar
 * seja substituicao total e nunca mesclagem. Qualquer excecao desfaz tudo.
 */
export function importarBackup(
  contratos: readonly ContratoDeDadosDeModulo[],
  arquivo: ArquivoDeBackup,
): Promise<ResultadoDaImportacao>;

/**
 * Exclusao FISICA de todos os dados do usuario, numa unica transacao sobre
 * TABELAS: chama `apagarTudo` de cada contrato. Nao registra acao no
 * historico e nao grava configuracao nenhuma (secao 6).
 */
export function apagarTudo(contratos: readonly ContratoDeDadosDeModulo[]): Promise<void>;
```

Regras que valem para toda implementação de `ContratoDeDadosDeModulo`, hoje e em cada fase nova (entram no checklist do `revisor-critico`):

1. **Só promessas do Dexie** dentro de `exportarJson`, `importarJson`, `exportarCsv` e `apagarTudo`. `fetch`, `setTimeout` ou qualquer `await` de fora perde a zona da transação e o Dexie a fecha antes da hora (ADR 0005, seção 5).
2. **Nenhuma abre transação com tabela de fora do próprio módulo.** Se abrir, tem de ser subconjunto das tabelas do chamador, senão o Dexie recusa.
3. **`importarJson` limpa todas as tabelas do módulo e grava o que recebeu.** Tabela ausente no argumento fica **vazia** — é substituição, não mesclagem.
4. **`importarJson` grava o registro como está no arquivo.** Não regenera `id`, `createdAt` nem `updatedAt`, não usa `criarRegistro`/`atualizarRegistro` e não "conserta" nada em silêncio: ou o registro é válido, ou lança `ErroDeBackup('registroInvalido', ...)`.
5. **Chave de tabela desconhecida em `importarJson` lança** `ErroDeBackup('registroInvalido', ...)` — nunca é ignorada. Ignorar seria perder dado sem avisar.
6. **`exportarJson` devolve toda linha de toda tabela do módulo, ordenada por `id`**, inclusive as soft-deleted.
7. **`apagarTudo` é `clear()` físico** em cada tabela do módulo, e não grava nada.

#### 4.3 `src/modulos/nucleo/repositorio/contrato-de-dados.ts` — o núcleo como módulo

Separado do orquestrador de propósito: um arquivo é "o núcleo participando do backup", o outro é "o núcleo coordenando o backup de todos". (Pequeno desvio da árvore do ADR 0002, que previa só `repositorio/backup.ts`.)

```ts
export const contratoDeDadosDoNucleo: ContratoDeDadosDeModulo;
```

Comportamento, tabela por tabela:

- **`exportarJson`** → `{ configuracoes: [...], historicoDeAcoes: [...] }`, ambas ordenadas por `id`. `configuracoes` tem 0 ou 1 linha (0 = usuário nunca salvou; o backup registra essa ausência, que é informação real).
- **`importarJson`** → `clear()` nas duas tabelas e `bulkPut` do que veio, depois de validar:
  - `configuracoes`: no máximo **uma** linha; `id === ID_DAS_CONFIGURACOES`; `validarConfiguracoes` sem problemas; `unidadeDePeso` e `tema` dentro das uniões. Qualquer desvio → `registroInvalido`.
  - `historicoDeAcoes`: `modulo` pertence a `IdDeModulo`; `tipo` é string não vazia cujo prefixo antes do `.` é igual a `modulo` (a invariante do ADR 0005, seção 3.2); `dia` casa `^\d{4}-\d{2}-\d{2}$`; `ocorridaEm` é instante ISO; `quantidade` é `null` ou inteiro; `referenciaId` é `null` ou string.
  - **`tipo` fora de `TipoDeAcao` é aceito** se passar na invariante do prefixo. Um build mais novo do app pode ter criado `'treino.serieRegistrada'` sem mudar o schema, e recusar o arquivo inteiro por causa disso significaria impedir o usuário de restaurar o próprio backup. Consequência a registrar para o item 5.2: **o cálculo de XP precisa de um caso padrão com peso 0 para tipo desconhecido** — o `switch-exhaustiveness-check` cobre o compilador, não o dado vindo de arquivo.
- **`exportarCsv`** → os dois arquivos da seção 3, só linhas ativas.
- **`apagarTudo`** → `clear()` nas duas tabelas.

#### 4.4 `src/modulos/nucleo/index.ts`

Passa a exportar, além do que já exporta (e o comentário desatualizado sai):

```ts
export const contratoDeDados: ContratoDeDadosDeModulo = contratoDeDadosDoNucleo;

export {
  exportarBackup, exportarCsvPorModulo, importarBackup, apagarTudo,
  VERSAO_DO_SCHEMA,
} from './repositorio/backup';
export type { CsvsDeModulo, ResultadoDaImportacao } from './repositorio/backup';
export {
  serializarBackup, lerBackup, resumirBackup, montarCsv,
  nomeDoArquivoDeBackup, nomeDoArquivoCsv, ErroDeBackup, ehErroDeBackup,
  FORMATO_DO_BACKUP, VERSAO_DO_FORMATO_DE_BACKUP,
} from './dominio/backup';
export type {
  ArquivoDeBackup, MetadadosDoBackup, DadosDeModulo, ResumoDoBackup, ResumoDeModulo,
  ResumoDeTabela, LeituraDeBackup, CodigoDeErroDeBackup, ColunaCsv,
} from './dominio/backup';
```

`VERSAO_DO_SCHEMA` sai por `repositorio/backup.ts` (que já importa `@/persistencia` legitimamente), não como import direto de `@/persistencia` dentro deste `index.ts` — assim `modulos/nucleo/index.ts` não precisa de uma exceção própria na fronteira de import (ADR 0002, seção 4). `Dados.tsx` continua consumindo `VERSAO_DO_SCHEMA` só a partir de `@/modulos/nucleo`, sem mudança de contrato.

`montarCsv` e `ColunaCsv` saem para fora porque cada pilar monta o CSV das suas tabelas e não pode fazer import profundo no núcleo. `lerBackup` e `serializarBackup` saem porque a tela é quem tem o texto do arquivo em mãos — ela lê e valida **antes** de pedir confirmação, sem tocar no banco.

### 5. Importação: validação e atomicidade

#### 5.1 O caminho completo

1. A tela recebe um `File` do `<input type="file">` e lê o texto com `File.text()`.
2. `lerBackup(texto, VERSAO_DO_SCHEMA)` — puro, sem banco. Erro aqui **não chega perto do IndexedDB**: a tela mostra a mensagem do código e o banco continua intacto.
3. A tela mostra `resumirBackup(arquivo)` (data do arquivo e contagem por módulo) com o aviso de que importar substitui tudo, e pede confirmação (seção 7).
4. Confirmado, `importarBackup(contratos, arquivo)`: **uma** transação `rw` sobre `TABELAS`, chamando `importarJson` de cada contrato. Validação de campo de negócio acontece aqui dentro, por módulo.
5. Qualquer exceção em qualquer módulo desfaz a transação inteira: **ou o banco fica exatamente como o arquivo, ou fica exatamente como estava antes**. Não existe estado intermediário, nem módulo importado pela metade.

#### 5.2 Duas camadas de validação, de propósito

| Camada | Onde | Valida | Falha |
|---|---|---|---|
| Envelope | `lerBackup` (puro) | metadados, versões, módulos conhecidos, forma de `RegistroBase`, `id` duplicado | antes de abrir transação; banco intacto |
| Negócio | `importarJson` de cada módulo | campos da entidade, uniões de literais, invariantes (prefixo de `tipo`, id sentinela das configurações) | dentro da transação; rollback total |

A camada de negócio mora no módulo dono porque só ele conhece as suas tabelas e os seus campos — a alternativa (o núcleo validando tudo) exigiria o núcleo conhecer o schema dos pilares, que é exatamente o que a seção 5 da especificação proíbe.

#### 5.3 Arquivo de outra versão de schema

**A v1 bloqueia**, com mensagem específica para cada lado:

- `schemaMaisNovo`: "Este backup foi gerado por uma versão mais nova do app. Atualize o app e tente de novo." Não há como um app antigo adivinhar campos que ainda não existem, e importar por cima perderia dado em silêncio.
- `schemaMaisAntigo`: "Este backup foi gerado por uma versão anterior do app, que ainda não sabe ser convertida. Guarde o arquivo." Hoje esse caminho é inalcançável (só existe a versão 1), mas `lerBackup` recebe a versão atual por parâmetro, então o `testador` cobre os dois ramos.

**Regra para as fases seguintes** (entra no checklist do `revisor-critico`, junto com as quatro obrigações do ADR 0005, seção 4): a entrega que cria a migração `vN+1` do schema decide e implementa, no mesmo commit, **como um backup da versão `N` é convertido** — com ADR próprio se o desenho pedir. Nunca por tolerância silenciosa ("faltou o campo, assume zero") escondida no `importarJson`.

Por que bloquear agora em vez de já entregar um conversor: hoje existe **uma** versão de schema, então um conversor não teria nem um caso real para converter — seria mecanismo especulativo, proibido pelo `CLAUDE.md`. E o custo de bloquear é nulo neste momento: o app não está nas mãos do usuário (D2: ele testa no fim da Fase 5), logo nenhum backup com dado real existe para ficar órfão.

#### 5.4 Pilares continuam vazios, mas deixam de ser silenciosos

`treino`, `estudos` e `financas` seguem sem tabela. Único ajuste nos três `index.ts`: `importarJson` passa a **rejeitar** quando recebe alguma chave de tabela, em vez de resolver sem fazer nada. Um arquivo editado à mão, ou vindo de um build de outra origem, não pode fazer o app anunciar "backup importado" tendo descartado os dados de treino em silêncio. São três linhas por módulo e desaparecem quando o módulo ganhar tabela de verdade.

### 6. Apagar tudo

`apagarTudo(contratos)`: uma transação `rw` sobre `TABELAS` chamando `apagarTudo()` de cada módulo, que faz `clear()` **físico** nas suas tabelas. É a única exclusão física do app (ADR 0005, seção 2, regra 6).

Estado depois de apagar tudo:

| O que | Fica como |
|---|---|
| `configuracoes` | **vazia**. A linha sentinela é removida, não zerada |
| `historicoDeAcoes` | vazia |
| Tabelas dos pilares | vazias (não existem ainda) |
| `obterConfiguracoes()` | devolve `CONFIGURACOES_PADRAO`, com `onboardingConcluidoEm === null` |
| Estado do app | **primeiro uso**: é exatamente o que o onboarding (5.3) vai usar como gatilho |
| Banco `app-rotina-db` | continua existindo, na versão atual do schema, com as tabelas vazias |
| Permissão de armazenamento persistente | mantida (não é dado do usuário) |
| Service worker e cache de assets | mantidos — só código do app, nenhum dado do usuário. O app continua instalado e continua funcionando offline |

Decisões embutidas:

- **Nenhuma ação de histórico é registrada**, nem em `apagarTudo` nem em `importarBackup`. Em `apagarTudo` seria absurdo (sobraria uma linha depois de "apagar tudo", e o app não voltaria ao primeiro uso); em `importarBackup` quebraria a idempotência de exportar → importar → exportar, que é justamente o teste que prova que o backup é fiel.
- **Não se apaga o banco** (`db.delete()`): a instância aberta ficaria inválida, o app precisaria recarregar, e o ganho seria zero — as tabelas vazias já devolvem o app ao primeiro uso. Ver "Alternativas".
- **Sem desfazer.** É irreversível e o texto da tela diz isso com essas palavras, além de sugerir exportar antes.

### 7. A tela `Dados.tsx`

Primeira tela real do projeto. Rota nova `/dados` em `src/app/rotas.tsx`, e a Hoje placeholder recebe um link para ela (a navegação de verdade chega em 0.11). `Dados` recebe **`contratos: readonly ContratoDeDadosDeModulo[]` por prop**, passada por `rotas.tsx` a partir de `contratosDeDados` — a tela não importa `@/app/modulos` (import proibido pela matriz) e o núcleo continua sem conhecer os pilares.

Estrutura: `<main>` com `<h1>Dados</h1>` e quatro `<section>` com `<h2>`, nesta ordem (do mais seguro ao mais destrutivo):

**7.1 Backup completo (JSON)** — um botão `Exportar backup (JSON)`. Ao toque: `exportarBackup(contratos)` → `serializarBackup` → `salvarArquivo` (7.5) com `nomeDoArquivoDeBackup(hojeEmDataDeCalendario())`. Sucesso → mensagem `role="status"` com o nome do arquivo. Se o salvamento pedir toque novo (fato 2 do Contexto), aparece um botão `Salvar arquivo` que repete o salvamento com o conteúdo já em memória.

**7.2 CSV por módulo** — uma subseção por módulo (`<h3>` com o nome do módulo). Botão `Preparar CSV de <módulo>`; depois de gerar, uma lista com um botão `Baixar <nome do arquivo>` por arquivo. Módulo sem dado mostra o texto "Sem dados para exportar ainda." — texto, não botão desabilitado sem explicação.

**7.3 Importar backup** — `<label>` + `<input type="file" accept="application/json,.json">` visível e rotulado (não escondido atrás de botão estilizado: rótulo real é requisito de leitor de tela e é o que o Playwright usa com `setInputFiles`). Escolhido o arquivo, a tela lê, valida com `lerBackup` e mostra:
- em caso de erro, `role="alert"` com a mensagem do código e um `<details>` "Detalhes técnicos" com `detalhe`;
- em caso de sucesso, o resumo (`resumirBackup`) + aviso de substituição + botões `Importar e substituir` e `Cancelar`.
São **dois passos** (escolher arquivo → confirmar com o resumo na frente). Não pede digitação: escolher um arquivo específico já é ato deliberado, e o resumo mostra exatamente o que vai entrar.

**7.4 Apagar todos os dados** — fluxo de **dois passos com palavra de confirmação**:
1. Botão `Apagar todos os dados` (estilo destrutivo, e a palavra "apagar" no rótulo — nunca só cor, que falharia contraste/daltonismo).
2. Área de confirmação revelada no DOM, com foco movido para o título dela (`tabIndex={-1}` + `focus()`), contendo: o aviso completo, um campo `Para confirmar, digite APAGAR`, a dica "O botão libera quando a palavra estiver correta.", e os botões `Apagar tudo agora` (desabilitado até a palavra bater, comparando com `trim()` e maiúsculas) e `Cancelar`.
3. Sucesso → `role="status"`: "Tudo apagado. O app voltou ao estado de primeiro uso." O foco vai para a mensagem.

Palavra `APAGAR`: sem acento, curta, e em pt-BR — digitar é o que impede o toque acidental numa ação irreversível, e é mais forte que dois toques seguidos. Sem `window.confirm` (visual do navegador, fora do tema, sem controle de foco, e bloqueado em alguns contextos) e sem modal com `<dialog>` (exige armadilha de foco própria para um caso só; a revelação inline com foco movido resolve o mesmo com menos código).

**7.5 Salvar e ler arquivo no navegador** — `src/ui/arquivos.ts` (camada de interface: `src/compartilhado/**` roda sem DOM por configuração do ESLint, então este helper não pode morar lá):

```ts
export interface ArquivoParaSalvar {
  readonly nome: string;
  readonly tipoMime: string;    // 'application/json' | 'text/csv;charset=utf-8'
  readonly conteudo: string;
}
export type ResultadoDeSalvar = 'salvo' | 'cancelado' | 'precisaDeNovoToque';

export function salvarArquivo(arquivo: ArquivoParaSalvar): Promise<ResultadoDeSalvar>;
export function lerTextoDeArquivo(arquivo: File): Promise<string>;
```

`salvarArquivo`:
1. Se o app está instalado (`matchMedia('(display-mode: standalone)').matches` ou `navigator.standalone === true`) **e** `navigator.canShare?.({ files: [file] })` → `navigator.share({ files: [file] })`. É o único caminho que funciona no iPhone instalado (fato 1).
2. Caso contrário → `<a href={URL.createObjectURL(blob)} download={nome}>` **anexado ao DOM**, `click()`, remoção e `revokeObjectURL` no tique seguinte. No navegador e no desktop isso é melhor que a folha de compartilhamento, e é o caminho determinístico que o Playwright observa como `download`.
3. `AbortError` no `share` → `'cancelado'` (o usuário fechou a folha; não é erro). Qualquer outra falha do `share` → `'precisaDeNovoToque'`, que a tela transforma no botão `Salvar arquivo` (fato 2).

**7.6 Acessibilidade (seção 8 da especificação, WCAG 2.2 AA)**

- Todo controle é elemento nativo (`<button>`, `<input>`, `<label>`, `<details>`): teclado, foco e semântica vêm de graça.
- Alvo de toque **mínimo 44 × 44 px** garantido por token (`--alvo-minimo: 44px`) aplicado em `min-height`/`min-width` de `Botao` e do campo de texto, com espaçamento vertical suficiente entre ações vizinhas.
- Rótulo visível e associado em todo campo (`<label for>`); nenhum rótulo só por `placeholder`.
- Feedback: sucesso em `role="status"` (`aria-live="polite"`), erro em `role="alert"`; operação em curso com `aria-busy="true"` no botão e o texto do estado ("Gerando arquivo...") — nunca só um spinner.
- Ordem de foco é a ordem do DOM; ao revelar a confirmação, o foco vai para o título dela; depois de concluir, para a mensagem de resultado.
- **`prefers-reduced-motion`**: a revelação é instantânea, sem animação. Qualquer transição futura entra atrás de `@media (prefers-reduced-motion: reduce)` em `global.css`, que nasce aqui já com a regra de neutralizar animação e transição.
- Nada de informação transmitida só por cor; contraste dos tokens verificado em AA (inclusive o vermelho da ação destrutiva sobre o fundo dela).
- O axe roda em `/dados` nos dois projetos do Playwright, e a tela é percorrida por teclado num e2e (Definition of Done).

**7.7 Textos pt-BR** — todos em `src/i18n/pt-BR/nucleo.ts`, sob `nucleo.dados.*`, incluindo **uma mensagem por `CodigoDeErroDeBackup`** em `nucleo.dados.erros.<codigo>` (o mapeamento código → texto é da interface; o domínio nunca devolve texto de usuário) e um `nucleo.dados.erros.falhaInesperada` para o que não for `ErroDeBackup`. Textos que precisam sair exatamente assim:

- Introdução: "Seus dados ficam só neste dispositivo. Exporte um backup de vez em quando para não depender de um aparelho só."
- Ajuda do JSON: "Gera um arquivo com tudo: configurações, histórico e os dados de todos os módulos, inclusive itens que você excluiu. O arquivo não tem senha — guarde num lugar seguro."
- Ajuda do CSV: "O CSV serve para abrir numa planilha. Ele traz só os itens ativos; para restaurar o app, use o backup em JSON."
- Aviso da importação: "Importar substitui todos os dados atuais por este arquivo. Não é possível desfazer."
- Aviso do apagar tudo: "Isto apaga definitivamente tudo que você registrou neste app: configurações, histórico e os dados de treino, estudos e finanças. Não é possível desfazer e não fica nenhuma cópia no aparelho. O app continua instalado e volta ao estado de primeiro uso."
- Se quiser guardar o estado atual antes: "Exporte um backup antes de continuar."

Nenhuma mensagem exibe conteúdo de registro do usuário — só contagens, nomes de tabela e nomes de arquivo.

**7.8 Componentes e estilos mínimos** — não existe nada em `src/ui/` nem um arquivo `.css` no projeto. Esta entrega cria o mínimo, e só o mínimo: `src/ui/Botao.tsx` (variantes `primario`, `secundario`, `destrutivo`), `src/ui/Campo.tsx` (rótulo + input + dica), `src/ui/Aviso.tsx` (`status` | `alerta`), `src/app/estilos/tokens.css` (cores AA, espaçamento, `--alvo-minimo`, tema claro/escuro por `prefers-color-scheme`) e `src/app/estilos/global.css` (reset curto + bloco de `prefers-reduced-motion`), mais `Dados.module.css`. O sistema visual definitivo é dos itens 0.7, 0.10 e 0.11; aqui não se inventa componente que a tela de Dados não use.

### 8. Quem faz o quê

| Agente | Arquivos |
|---|---|
| `dominio` | `src/modulos/nucleo/dominio/backup/{formato,erros,json,csv,nomes,index}.ts`; `src/modulos/nucleo/repositorio/{backup,contrato-de-dados}.ts`; `src/modulos/nucleo/index.ts` (contrato real + novas exportações); `src/modulos/{treino,estudos,financas}/index.ts` (só a rejeição da seção 5.4); `src/persistencia/{transacao,index}.ts` (só `emTransacaoDeLeitura`) |
| `interface` | `src/modulos/nucleo/telas/Dados.tsx` (+ `Dados.module.css`); `src/ui/{Botao,Campo,Aviso}.tsx`, `src/ui/arquivos.ts`, `src/ui/index.ts`; `src/app/estilos/{tokens,global}.css`; `src/app/{rotas.tsx,main.tsx}` (rota `/dados`, link na Hoje, import do CSS); `src/i18n/pt-BR/nucleo.ts` |
| `testador` | `src/modulos/nucleo/dominio/backup/{json,csv,nomes}.test.ts`; `src/modulos/nucleo/repositorio/backup.test.ts`; `src/modulos/nucleo/repositorio/contrato-de-dados.test.ts`; `e2e/dados.spec.ts`; `e2e/paginas/dados.ts`; `e2e/fixtures/backup-exemplo.json`; uma linha em `e2e/acessibilidade.spec.ts` |

Ordem: `dominio` → `interface` (contrato já fechado aqui, então a interface pode começar contra as assinaturas) → `testador` → `revisor-critico` (item de backup e privacidade, pela tabela do `CLAUDE.md`).

Nenhum `.gitkeep` sobrevive em pasta que passou a ter arquivo (`src/modulos/nucleo/telas/`, `src/app/estilos/`).

### 9. Critérios de aceite do item 0.6

O item só está pronto quando todos passarem:

1. `npm run verificar` termina com código 0 (lint, format, typecheck, unit, build) e `npm run test:e2e` passa nos dois projetos.
2. **Nenhuma dependência nova:** `npm ls --depth=0` idêntico ao do item 0.5. Nenhum `fetch`, `XMLHttpRequest`, `WebSocket` ou URL externa aparece em `src/` (busca no código como parte da revisão).
3. **Fronteiras intactas:** nenhum arquivo de `telas/`, `componentes/`, `ui/` ou `app/` importa `@/persistencia` ou `dexie`; `dominio/backup/**` não importa React, DOM, Dexie nem `@/persistencia`; o núcleo não importa nenhum pilar; nenhum `eslint-disable` novo.
4. **Exportação completa:** com uma configuração salva e três ações registradas (uma delas com soft delete), `exportarBackup(contratosDeDados)` devolve `metadados` com `formato`, `versaoDoFormato: 1`, `versaoDoSchema: VERSAO_DO_SCHEMA` e `geradoEm` ISO em UTC, e `modulos.nucleo` com **as três ações, incluindo a excluída**, e a linha de configuração. `treino`, `estudos` e `financas` aparecem como `{}`.
5. **Metadados sem rastro:** as chaves de `metadados` são exatamente `formato`, `versaoDoFormato`, `versaoDoSchema`, `geradoEm` — nada de user agent, modelo de aparelho, fuso ou identificador de instalação.
6. **Determinismo:** exportar duas vezes o mesmo banco produz strings idênticas, exceto `metadados.geradoEm`; cada tabela sai ordenada por `id` crescente.
7. **Ida e volta fiel:** exportar → `apagarTudo` → importar o mesmo arquivo → exportar de novo produz um JSON **igual ao primeiro** (exceto `geradoEm`), com `id`, `createdAt`, `updatedAt` e `deletedAt` preservados byte a byte. Nenhuma ação de histórico é criada pela importação (a contagem de linhas de `historicoDeAcoes` é a do arquivo, não a do arquivo + 1).
8. **Importação é substituição, não mesclagem:** banco com 5 ações + importar arquivo com 2 ações resulta em **exatamente 2**; e importar um arquivo cujo `modulos.nucleo` não traz a chave `configuracoes` deixa a tabela `configuracoes` **vazia**.
9. **Atomicidade da importação:** com um contrato falso que lança no `importarJson`, `importarBackup` rejeita e **todas** as tabelas continuam exatamente como estavam (asserção em cada tabela, e não só na contagem total).
10. **Validação do envelope sem tocar no banco:** para cada entrada abaixo, `lerBackup` devolve `{ ok: false }` com o código indicado, e a contagem de linhas do banco não muda: texto vazio e `'{'` → `jsonInvalido`; `{}` e `{"metadados":{"formato":"outro"},"modulos":{}}` → `naoEhBackup`; `versaoDoFormato: 2` → `formatoMaisNovo`; `versaoDoSchema: 2` (com atual 1) → `schemaMaisNovo`; `versaoDoSchema: 1` com atual 2 → `schemaMaisAntigo`; chave `"saude"` em `modulos` → `moduloDesconhecido`; `modulos.nucleo.configuracoes` igual a `{}` → `estruturaInvalida`; registro sem `id`, com `deletedAt: undefined`, com `createdAt: '2026-09-22'` (data sem hora) ou com `id` repetido → `registroInvalido`.
11. **Validação de negócio dentro da transação:** importar arquivo com duas linhas em `configuracoes`, com `id` diferente de `configuracoes-unicas`, com `metaSemanalDeTreinos: -1`, com `tema: 'roxo'`, ou com ação cujo `tipo` é `'financas.x'` e `modulo` é `'nucleo'` → rejeita com `registroInvalido` e o banco fica intacto.
12. **`tipo` desconhecido é aceito:** ação com `tipo: 'treino.serieRegistrada'` e `modulo: 'treino'` importa com sucesso e volta igual numa nova exportação.
13. **Tabela desconhecida não é silenciosa:** arquivo com `modulos.nucleo.tabelaInventada: []` ou com `modulos.treino.series: [...]` faz a importação **rejeitar** (nunca resolver ignorando dado).
14. **Apagar tudo:** depois de `apagarTudo(contratosDeDados)`, toda tabela de `TABELAS` tem `count() === 0`, `obterConfiguracoes()` devolve `CONFIGURACOES_PADRAO` com `onboardingConcluidoEm === null`, e o banco continua aberto na versão atual (`db.verno` inalterado). Nenhuma linha nova em `historicoDeAcoes`.
15. **CSV:** `exportarCsvPorModulo` devolve dois arquivos para o núcleo (`nucleo-configuracoes.csv`, `nucleo-historico-de-acoes.csv`) e lista vazia para os três pilares. Os arquivos começam com BOM, usam `;` e CRLF, trazem o cabeçalho na ordem declarada na seção 3, **não trazem a linha soft-deleted** e, com a tabela vazia, trazem só o cabeçalho.
16. **Escape e injeção no CSV:** valor de texto com `;`, com `"` e com quebra de linha volta corretamente escapado (aspas dobradas), `null` vira campo vazio, número sai sem formatação, e texto começando com `=`, `+`, `-`, `@` ou TAB sai prefixado com `'` e entre aspas.
17. **Nomes de arquivo:** `nomeDoArquivoDeBackup('2026-09-22') === 'app-rotina-backup-2026-09-22.json'` e `nomeDoArquivoCsv('nucleo-configuracoes.csv', '2026-09-22') === 'nucleo-configuracoes-2026-09-22.csv'`. Nenhum nome de arquivo usa `NOME_DO_APP`.
18. **E2e do fluxo crítico (especificação, seção 9), nos dois projetos:** abrir `/dados` a partir da Hoje; importar `e2e/fixtures/backup-exemplo.json`; conferir o resumo antes de confirmar; confirmar; exportar o backup e **comparar o arquivo baixado** com a fixture (ignorando `geradoEm`); baixar um CSV e conferir o cabeçalho; apagar tudo pelo fluxo de dois passos com a palavra `APAGAR`; **recarregar a página**, exportar de novo e conferir que todas as tabelas estão vazias (prova de que apagar tudo sobreviveu ao fechamento).
19. **E2e do caminho de erro:** importar um `.json` malformado e um backup com `versaoDoSchema: 99` mostra a mensagem em pt-BR com `role="alert"`, e um export feito em seguida prova que o banco não mudou.
20. **E2e de acessibilidade e teclado:** `/dados` entra em `e2e/acessibilidade.spec.ts` e passa sem violação nas cinco etiquetas WCAG nos dois projetos; um teste percorre a tela só com teclado (`Tab`/`Enter`/digitação) até apagar tudo; a auditoria confirma que todo botão e o campo de confirmação têm caixa de pelo menos 44 × 44 px (medida por `boundingBox()`).
21. **Sem toque acidental:** `Apagar tudo agora` fica desabilitado com o campo vazio e com `APAGA`, e habilita com `apagar`, `APAGAR` e ` APAGAR `.
22. **A tela não fala com o banco nem com a rede:** `Dados.tsx` importa apenas `@/modulos/nucleo`, `@/ui`, `@/i18n` e `@/compartilhado`, e recebe `contratos` por prop.
23. **Offline:** o e2e do fluxo completo passa com `context.setOffline(true)` (Chromium, pendência 10 do plano) depois do primeiro carregamento.
24. Cobertura do Vitest cobre `src/modulos/nucleo/dominio/backup/**` sem arquivo em 0%.
25. `docs/PLANO.md` atualizado (item 0.6 pronto, suposições registradas) e `git status` limpo depois do commit.

### 10. O que fica de fora do item 0.6

- **Backup automático local e "últimas N cópias"** — item 5.4. Aqui é só manual.
- **Aviso periódico para exportar backup** — item 5.7. Ele vai precisar da data do último backup; a fonte natural é uma ação `nucleo.backupExportado` no histórico (não exige migração), mas **não** se inventa esse dado agora.
- **Conversão de backup entre versões de schema** — bloqueado com mensagem clara (seção 5.3); o desenho nasce junto da primeira migração que o exigir.
- **Importar CSV.** A especificação pede CSV só na exportação; restaurar é papel do JSON. Importação de dado externo é outra história (Anki, GPX/FIT), com telas próprias nas fases 1 e 3.
- **Mesclar backups, importar só um módulo, importar por intervalo de datas.**
- **Criptografia ou senha no arquivo**, e compactação (zip). O arquivo é texto puro, e a tela diz isso ao usuário.
- **Exportar em streaming.** O arquivo é montado inteiro em memória. Para um usuário só, com alguns milhares de linhas por ano, é irrelevante; se algum dia a Fase 3 gerar arquivos de dezenas de MB, isto volta como item próprio.
- **Purgar registros soft-deleted ("esvaziar excluídos")** — segue fora, como no ADR 0005.
- **Tela de configurações (0.10), Hoje de verdade (0.11), manifesto e ícones (0.7), prints (0.13).** A Dados ganha o seu print quando o item 0.13 montar `e2e/prints.spec.ts`.

## Alternativas consideradas

- **Acrescentar `tabelas: readonly string[]` ao `ContratoDeDadosDeModulo`**, para o núcleo validar todas as chaves de tabela antes de abrir transação. Daria mensagem de erro melhor, ao custo de mudar um contrato que o ADR 0002 fechou e de duplicar no contrato uma informação que já está no schema. Rejeitado: com a transação única, uma chave desconhecida lançada dentro do módulo já desfaz tudo — o resultado para o usuário é idêntico.
- **Mesclar em vez de substituir na importação** (`put` por `id`, mantendo o que já existe). Parece mais gentil, mas produz um estado que o usuário não consegue prever nem explicar ("de onde veio essa série?"), e faz o resultado depender da ordem das importações. Um backup é um instantâneo; restaurar é voltar ao instantâneo.
- **Aceitar backup de schema anterior com tolerância ("campo faltando assume o padrão")**. É exatamente o mecanismo que perde dado em silêncio e que a seção 5 da especificação proíbe ao exigir migrações explícitas. Bloquear com mensagem clara é honesto; converter de verdade é trabalho da entrega que criar a migração.
- **Entregar já o mecanismo de conversão de backup** (`ConversorDeBackup` com uma cadeia de passos e uma lista hoje vazia). Seria a solução completa, mas sem um único caso real para converter é abstração especulativa — e com o app ainda longe das mãos do usuário (D2), nenhum backup com dado real fica órfão nesse intervalo.
- **`window.confirm` para "apagar tudo"**. Uma linha de código, mas visual do navegador, fora do tema, sem controle de foco, bloqueável, e impossível de estilizar para o alvo de 44 px. Dois toques sem digitar também foi considerado: é mais fraco para uma ação irreversível.
- **`<dialog>` modal para as confirmações.** Semântica boa e suporte adequado hoje, mas exige tratar armadilha de foco e fechamento por `Esc` para dois casos. A revelação inline com foco movido dá o mesmo resultado auditável pelo axe com menos código; se aparecer um terceiro caso, vale promover a um componente de diálogo em `src/ui/`.
- **`showSaveFilePicker` (File System Access API)** para o usuário escolher a pasta. Não existe no Safari (fato 3 do Contexto), que é justamente o alvo principal.
- **Só `<a download>`, sem Web Share.** É o padrão web e é o que o Playwright observa, mas é silenciosamente ignorado no PWA instalado do iPhone (fato 1) — o usuário tocaria em "Exportar" e nada aconteceria, no aparelho que mais importa.
- **Só Web Share, sem `<a download>`.** Ruim no desktop (folha de compartilhamento para salvar um arquivo) e indisponível em vários navegadores; deixaria o e2e sem caminho determinístico.
- **CSV com separador `,` (RFC 4180 estrito).** Mais interoperável no papel, mas abre tudo na coluna A no Excel em pt-BR — que é onde este arquivo vai ser aberto. Como a importação não lê CSV, a escolha não afeta integridade: é ergonomia, e é uma constante.
- **CSV com todas as linhas, inclusive as excluídas** (espelhando o JSON). Uniforme, porém perigoso numa planilha: somar uma coluna de gastos incluiria lançamentos apagados. O JSON continua sendo o arquivo completo.
- **Um zip com todos os CSVs.** Precisaria de `fflate` (dependência nova, prevista só para a Fase 3) para resolver algo que um botão por arquivo resolve.
- **`db.delete()` em "apagar tudo"** em vez de `clear()` por tabela. Apagaria o banco inteiro, mas invalidaria a conexão aberta, exigiria recarregar o app e recriar o schema — mais partes móveis para um resultado idêntico ao do usuário.
- **Registrar "backup exportado/importado/dados apagados" no histórico.** Útil para o item 5.7, mas hoje quebraria a idempotência do ciclo exportar → importar → exportar e deixaria uma linha viva depois de "apagar tudo".
- **Colocar o helper de salvar arquivo em `src/compartilhado/`.** Impossível por configuração: o ESLint roda `src/compartilhado/**` sem globais de DOM, de propósito (ADR 0002). O lugar certo é a camada de interface.

## Consequências

- **O princípio 3 passa a ser verificável.** A Definition of Done ("está coberta pela exportação e importação de backup") ganha um teste concreto: toda tabela nova precisa aparecer no `exportarJson` do seu módulo e voltar idêntica na importação — e o critério 7 (ida e volta fiel) é o teste que qualquer fase pode copiar.
- **Toda fase nova ganha três obrigações**, que se somam às quatro do ADR 0005 (migração, `TABELAS`, tipo, teste): entrar em `exportarJson`/`importarJson`/`apagarTudo` do módulo, declarar as colunas do seu CSV, e definir a conversão do backup da versão anterior. O `revisor-critico` reprova sem elas.
- **A importação é a operação mais perigosa do app** e agora tem uma única porta, com validação em duas camadas e uma transação. Em troca, qualquer validação esquecida na camada de negócio vira dado inválido no banco — daí os critérios 11 a 13 serem tão detalhados.
- **Bloquear backup de outra versão de schema tem prazo de validade.** A primeira migração da Fase 1 torna inúteis os backups gerados na Fase 0. Hoje isso não custa nada (ninguém tem dado real), mas deixa de ser aceitável a partir da Fase 5: a regra da seção 5.3 é o que impede que isso passe batido.
- **`tipo` do histórico deixa de ser garantido pelo compilador** depois de uma importação: o dado pode conter um literal fora de `TipoDeAcao`. O cálculo de XP (item 5.2) precisa de caso padrão com peso 0.
- **A Fase 0 ganha sua primeira tela e, com ela, os primeiros tokens de estilo, os três primeiros componentes de `src/ui/` e a primeira rota.** Os itens 0.7, 0.10 e 0.11 herdam essa base em vez de criá-la — e herdam também a dívida de revisar os tokens quando o tema definitivo chegar.
- **Salvar arquivo passa a ter dois caminhos** (compartilhar no PWA instalado, baixar no navegador). Só um deles é exercitado pelo Playwright; o WebKit do Playwright não é o Safari do iPhone. A validação real do salvamento no iPhone instalado só acontece no roteiro de teste manual do item 5.8 — e é o principal risco residual deste item.
- **O arquivo de backup é texto puro, sem senha.** É a escolha consciente (local-first, sem criptografia para esquecer chave), e a tela diz isso em pt-BR em vez de fingir segurança.

## Pendências

### Bloqueantes

Nenhuma.

### Não bloqueantes (suposições que seguem se não houver resposta)

1. **Nome do arquivo exportado:** `app-rotina-backup-AAAA-MM-DD.json`, com o mesmo identificador técnico do banco. Quando o nome do produto sair do placeholder (pendência 8/9), troca-se uma constante; a importação nunca depende do nome.
2. **Dois backups no mesmo dia** ficam com o mesmo nome; quem resolve é o navegador ou o app Arquivos (sufixo `(1)` ou pedido de substituição). Não se inclui hora no nome para manter o nome legível.
3. **CSV com separador `;`, CRLF e BOM**, para abrir com dois toques no Excel em pt-BR. Afeta só ergonomia: a importação não lê CSV.
4. **CSV traz só linhas ativas**, com colunas declaradas por tabela (`id` + campos de negócio + `createdAt`). O JSON é o arquivo completo.
5. **Palavra de confirmação para apagar tudo: `APAGAR`**, comparada sem diferenciar maiúsculas e com `trim()`.
6. **Importar não pede palavra digitada** — pede escolher o arquivo e confirmar com o resumo à vista (dois passos).
7. **Backup de outra versão de schema é bloqueado** com mensagem específica, em vez de convertido (seção 5.3).
8. **Nem importar nem apagar tudo registram ação no histórico**; exportar também não (a fonte de dado do item 5.7 é decidida lá).
9. **`apagarTudo` não apaga o banco nem o cache do service worker** — só os dados do usuário. O app continua instalado e offline.
10. **Os stubs de `treino`, `estudos` e `financas` passam a rejeitar** dados de tabela na importação, em vez de ignorar em silêncio.
11. **Pilar sem dado aparece no arquivo como `{}`** e, no CSV, como "Sem dados para exportar ainda."

## Fontes consultadas em 22/09/2026

- Web Share API — nível 2 (compartilhar `files`), `navigator.canShare`, exigência de **ativação transitória** e `NotAllowedError`: <https://w3c.github.io/web-share/> e <https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share>
- WebKit — API de ativação do usuário e janela de ativação transitória (~5 s, consumida por `await`): <https://webkit.org/blog/13862/the-user-activation-api/>
- `download` em `<a>` ignorado pelo Safari em modo standalone; correção pela folha de compartilhamento com `File`/`Blob`: <https://github.com/oneminch/deadlines/pull/118> e <https://developer.apple.com/forums/thread/95911>
- Limitações de PWA no iOS em 2026 (downloads, standalone): <https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide>
- File System Access API (`showSaveFilePicker`) sem suporte no Safari e no Firefox: <https://caniuse.com/native-filesystem-api> e <https://developer.mozilla.org/en-US/docs/Web/API/File_System_API>
- RFC 4180 (CSV: CRLF, aspas duplicadas) — base do formato, com o desvio de separador documentado na seção 3: <https://www.rfc-editor.org/rfc/rfc4180>
- Injeção de fórmula em CSV (OWASP, "CSV Injection"): <https://owasp.org/www-community/attacks/CSV_Injection>
- Dexie — `db.transaction(mode, tables, callback)`, modo `'r'`, rollback por exceção e reutilização da transação pai: <https://dexie.org/docs/Dexie/Dexie.transaction()>
- Playwright — eventos de `download` e `setInputFiles` (base do e2e do critério 18): <https://playwright.dev/docs/downloads> e <https://playwright.dev/docs/input#upload-files>
