# 0005. Persistência: banco, schema v1, migrações, transações e repositórios do núcleo

- Data: 2026-09-21
- Status: **aceita**. Decisão do usuário em 2026-09-21: valores padrão de configurações conforme proposto (metas preenchidas, orçamento em branco); nome do banco `app-rotina-db` (não `app-rotina`, para deixar explícito que é um identificador de banco de dados).

## Contexto

Item 0.5 do `docs/PLANO.md`: "Persistência, repositórios, schema versionado e migrações testadas". É a fundação de tudo que vem depois: as fases 1 a 4 só acrescentam tabelas e migrações ao padrão definido aqui, e o item 0.6 (exportar/importar/apagar tudo) é construído em cima destes contratos.

O que a especificação exige:

| Onde | Exigência |
|---|---|
| Seção 5 | Camada de repositório abstraindo a persistência; schema versionado com migrações explícitas e testadas; nunca quebrar dados de uma versão anterior |
| Seção 5 | IDs em UUID v7; datas ISO 8601 (calendário sem hora); dinheiro em centavos inteiros; soft delete com `deletedAt` |
| Seção 5 | Um módulo não acessa o armazenamento de outro diretamente |
| Seção 8 | **Gravações atômicas**; nenhuma perda de dado por fechamento inesperado |
| Seção 9 | Testes unitários **para as migrações de schema** |
| Seção 6.4 / item 0.10 | Configurações: metas semanais de foco e treino, orçamento mensal, unidades, tema |
| Item 0.12 / D5 | Histórico de ações com data, base do XP (derivado por função pura, sem contador gravado) |
| D4 | Regras leem metas/orçamento/unidades das configurações; **nunca valor fixo no código** |
| Princípio 3 / item 0.6 | Todo dado novo precisa caber em exportar, importar e apagar tudo |

O que já existe e não se reabre:

- **ADR 0001 (D9):** Dexie 4 sobre IndexedDB (`dexie@4.4.6`), `dexie-react-hooks`, `fake-indexeddb` nos testes.
- **ADR 0002:** árvore de `src/persistencia/` (`db.ts`, `migracoes/`, `tipos.ts`, `transacao.ts`, `index.ts`); matriz de imports (só `repositorio/` importa `@/persistencia`; `persistencia` só importa `@/compartilhado`); `dominio/` é puro (sem React, sem banco); nomes de tabela em camelCase plural pt-BR; proibido `enum`; `exactOptionalPropertyTypes` obriga `deletedAt: string | null`.
- **ADR 0002, seção 3:** `ContratoDeDadosDeModulo` e `CartaoDeHoje` já estão escritos em `src/modulos/nucleo/tipos.ts`.
- **ADR 0004:** `src/persistencia/ambiente.test.ts` provou que Dexie + `fake-indexeddb` + `version().upgrade()` funcionam sob Vitest 5 em `environment: 'node'`. Ownership: **todo `*.test.ts` é do agente `testador`**; `src/persistencia/**` e `src/modulos/*/repositorio/**` são do agente `dominio`.
- **Pendência 17 do plano:** o isolamento por nome de banco único do `ambiente.test.ts` **não** pode ser copiado para os testes do schema real. A decisão está fechada na seção 7 deste ADR.

Dois fatos técnicos verificados em 21/09/2026 que mudam o desenho (fontes ao fim):

1. **Dexie captura a fábrica de IndexedDB no construtor**, não na hora de abrir: `new Dexie(nome, opcoes)` resolve `indexedDB`/`IDBKeyRange` a partir de `opcoes` ou de `Dexie.dependencies`, que por sua vez foi lido do escopo global quando o módulo `dexie` foi importado. Consequência direta: **trocar `globalThis.indexedDB = new IDBFactory()` num `beforeEach` NÃO isola uma instância que já foi construída** (e a instância única do app é construída na importação do módulo). Isso invalida metade da pendência 17 na forma como estava escrita e leva à decisão da seção 7.
2. **IndexedDB não indexa `null` nem `undefined`**: quando o valor do `keyPath` não é uma chave válida, o registro é silenciosamente deixado de fora do índice, sem erro. Consequência direta: **`where('deletedAt').equals(null)` nunca funciona** e um índice em `deletedAt` conteria apenas os registros excluídos. Isso decide como o soft delete é consultado (seção 3.4).

## Decisão

### 1. `src/persistencia/db.ts` — a instância única

```ts
import Dexie from 'dexie';
import type { Table } from 'dexie';
import { MIGRACOES, VERSAO_DO_SCHEMA } from './migracoes';
import type { RegistroBase } from './tipos';

/**
 * Nome tecnico e fixo do banco. NAO deriva do nome do produto: o nome do app
 * ainda e placeholder (pendencia 8/9 do plano) e renomear um banco ja criado
 * no dispositivo do usuario significaria copiar dados ou perde-los.
 */
export const NOME_DO_BANCO = 'app-rotina-db';

export const TABELAS = ['configuracoes', 'historicoDeAcoes'] as const;
export type NomeDeTabela = (typeof TABELAS)[number];

export interface OpcoesDoBanco {
  /** Fabrica alternativa de IndexedDB. Usada so pelos testes (ver secao 7). */
  indexedDB?: IDBFactory;
}

/** Cria uma instancia do banco real, com o schema real e o nome real. */
export function criarBanco(opcoes: OpcoesDoBanco = {}): Dexie {
  const banco = new Dexie(NOME_DO_BANCO, opcoes);
  for (const migracao of MIGRACOES) {
    const versao = banco.version(migracao.versao).stores(migracao.stores);
    if (migracao.upgrade) versao.upgrade(migracao.upgrade);
  }
  return banco;
}

/** Instancia usada pelo app inteiro. Abre sozinha na primeira consulta. */
export const db = criarBanco();

/** Acesso tipado a uma tabela. O tipo do registro pertence ao modulo dono. */
export function tabela<T extends RegistroBase>(nome: NomeDeTabela): Table<T, string> {
  return db.table<T, string>(nome);
}

export { VERSAO_DO_SCHEMA };
```

Decisões embutidas:

- **Nome fixo, técnico, sem versão e sem relação com o nome do produto.** `app-rotina-db` deixa explícito, no próprio nome, que é um identificador de banco de dados — decisão do usuário em 2026-09-21, preferindo o sufixo `-db` a reaproveitar `app-rotina` (o `name` do `package.json`) sem sufixo.
- **`criarBanco()` existe para os testes** (seção 7) e para nada mais. O app usa `db`.
- **`TABELAS` é a lista única de tabelas**, consumida por `transacao.ts`, pelo backup (0.6) e pelo `apagarTudo`. Cada fase acrescenta o nome da sua tabela aqui **junto com** a migração.
- **`tabela<T>()` mantém o tipo da entidade no módulo dono.** `persistencia` não pode importar `@/modulos/*` (matriz do ADR 0002) e não vai importar: o schema (strings de índice) mora aqui, o tipo do registro mora no repositório do módulo. O parâmetro `nome` é da união `NomeDeTabela`, então errar o nome da tabela é erro de compilação.
- **Nada é chamado na importação.** `autoOpen` do Dexie abre na primeira consulta; importar `@/persistencia` durante o boot não bloqueia a primeira pintura.
- **`db.on('versionchange')` fica no padrão do Dexie** (fecha a conexão quando outra aba sobe a versão). O app é PWA de janela única; reavaliar só se aparecer problema real.

`src/persistencia/index.ts` (interface pública da camada, consumida só por `repositorio/`):

```ts
export { db, criarBanco, tabela, TABELAS, NOME_DO_BANCO, VERSAO_DO_SCHEMA } from './db';
export type { NomeDeTabela, OpcoesDoBanco } from './db';
export { emTransacao } from './transacao';
export { criarRegistro, atualizarRegistro, marcarComoExcluido, estaAtivo, apenasAtivos } from './tipos';
export type { RegistroBase, DadosDoRegistro } from './tipos';
export { solicitarArmazenamentoPersistente } from './armazenamento';
```

### 2. `src/persistencia/tipos.ts` — registro base e convenções de dados

```ts
import { gerarIdentificador } from '@/compartilhado';
import { agoraEmIso } from '@/compartilhado';

/**
 * Campos de controle de todo registro persistido (ADR 0002: sempre em ingles).
 * Nao sao `readonly`: as funcoes de upgrade das migracoes e o `Collection.modify`
 * do Dexie mutam o objeto, e o IndexedDB ja devolve uma copia a cada leitura.
 */
export interface RegistroBase {
  /** UUID v7 (`@/compartilhado`): unico e ordenavel cronologicamente como string. */
  id: string;
  /** Instante ISO 8601 em UTC com milissegundos: `2026-09-21T16:04:05.123Z`. */
  createdAt: string;
  /** Igual a `createdAt` na criacao; muda a cada gravacao. */
  updatedAt: string;
  /** `null` = ativo. Instante ISO em UTC quando excluido (soft delete). */
  deletedAt: string | null;
}

/** Os campos de negocio de um registro, sem os campos de controle. */
export type DadosDoRegistro<T extends RegistroBase> = Omit<T, keyof RegistroBase>;

export function criarRegistro<T extends RegistroBase>(dados: DadosDoRegistro<T>): T;
export function atualizarRegistro<T extends RegistroBase>(registro: T, mudancas: Partial<DadosDoRegistro<T>>): T;
export function marcarComoExcluido<T extends RegistroBase>(registro: T): T;
export function estaAtivo(registro: RegistroBase): boolean;          // registro.deletedAt === null
export function apenasAtivos<T extends RegistroBase>(registros: readonly T[]): T[];
```

Regras que valem para **todas** as tabelas, de agora até a Fase 5:

1. **Nenhum repositório monta `id`, `createdAt`, `updatedAt` ou `deletedAt` na mão.** Sempre `criarRegistro` / `atualizarRegistro` / `marcarComoExcluido`. É o único lugar que lê o relógio e o gerador de id.
2. **`criarRegistro` devolve um objeto novo**; `atualizarRegistro` devolve uma cópia com `updatedAt` novo e `createdAt` preservado; `marcarComoExcluido` preenche `deletedAt` **e** `updatedAt`. Escrita é sempre `put` do objeto inteiro — nada de `update` parcial no Dexie, para o registro no banco nunca divergir do tipo.
3. **Instantes** (`createdAt`, `updatedAt`, `deletedAt`, `ocorridaEm`): `new Date().toISOString()`, UTC, com `Z`. Ordenam lexicograficamente.
4. **Datas de calendário** (`dia` do histórico, e depois dia do treino e do gasto): string `AAAA-MM-DD` no **fuso local do dispositivo**. Nunca derivar de `toISOString().slice(0, 10)`: em `America/Sao_Paulo` isso erra o dia entre 21h e a meia-noite. Uso obrigatório de `dataDeCalendarioDe()` (item 4 abaixo).
5. **Grandezas com fração viram inteiro na menor unidade.** Dinheiro em centavos (já está em `compartilhado/dinheiro.ts`); tempo em minutos ou segundos inteiros; peso, quando chegar na Fase 1, em **gramas inteiros**, com `unidadeDePeso` das configurações servindo só para exibir e para o campo de entrada. Nenhum campo de banco guarda ponto flutuante — a única exceção admitida no futuro é distância, e ela também entra como metros inteiros.
6. **Soft delete é a regra**, inclusive no histórico. Exclusão física só acontece em `apagarTudo` (item 0.6).

`src/compartilhado/datas.ts` (previsto no ADR 0002, ainda não existe — nasce neste item, sem React e sem dependência):

```ts
export function agoraEmIso(): string;                       // instante UTC, `...Z`
export function dataDeCalendarioDe(instanteIso: string): string; // `AAAA-MM-DD` no fuso local
export function hojeEmDataDeCalendario(): string;           // dataDeCalendarioDe(agoraEmIso())
```

### 3. Schema v1

Duas tabelas nascem agora — só as do núcleo. Nenhuma tabela de pilar é criada antes da sua fase: criar tabela vazia "para depois" é schema sem teste e sem dono.

```ts
// src/persistencia/migracoes/v1-inicial.ts
export const v1Inicial: Migracao = {
  versao: 1,
  stores: {
    configuracoes: 'id',
    historicoDeAcoes: 'id, dia, tipo, modulo',
  },
};
```

#### 3.1 `configuracoes` — linha única

| Campo | Tipo | Observação |
|---|---|---|
| `id` | `string` | **sempre** `ID_DAS_CONFIGURACOES = 'configuracoes-unicas'` |
| `createdAt` / `updatedAt` / `deletedAt` | `string` / `string` / `string \| null` | `deletedAt` é sempre `null` aqui (ver abaixo) |
| `metaSemanalDeFocoEmMinutos` | `number` | inteiro ≥ 0. Usado pela regra 7.2 |
| `metaSemanalDeTreinos` | `number` | inteiro ≥ 0. Usado pela sequência semanal (6.3) |
| `orcamentoMensalEmCentavos` | `number \| null` | inteiro ≥ 0; `null` = não definido. Usado pela regra 7.3 |
| `unidadeDePeso` | `'kg' \| 'lb'` | só exibição; armazenamento é canônico (seção 2, regra 5) |
| `tema` | `'sistema' \| 'claro' \| 'escuro'` | especificação 6.4: segue o sistema por padrão |
| `onboardingConcluidoEm` | `string \| null` | instante ISO; `null` = o usuário ainda não confirmou nada |

Decisões:

- **Linha única com id sentinela fixo**, e não UUID v7. É a única exceção à convenção de id do projeto e ela é deliberada: com id gerado, duas abas (ou uma importação de backup) criariam duas linhas de configuração e o app teria dois estados. Com chave fixa, `put` é idempotente por construção. A exceção fica documentada no próprio arquivo.
- **Sem índice além da chave primária.** É uma linha.
- **Sem soft delete na prática.** `deletedAt` existe porque a forma do registro é uniforme (backup, helpers, importação), mas nada marca configuração como excluída; `apagarTudo` (0.6) remove a linha e o app volta ao estado de primeiro uso.
- **`onboardingConcluidoEm` entra agora** porque é o que separa "configuração padrão" de "o usuário decidiu isto" — a tela de Configurações (0.10), a Hoje (0.11) e o onboarding (5.3) precisam dessa distinção, e ela custa um campo.
- **Fica fora da v1** (entra na migração da fase que precisar): duração do Pomodoro (Fase 2), faixas de séries semanais da regra 7.7 (Fase 1), dias de aviso antes da renovação de assinatura (Fase 4), N cópias do backup automático (Fase 5). Cada uma nasce com a sua fase, exercitando o padrão de migração.

Valores padrão (`CONFIGURACOES_PADRAO`, em `nucleo/dominio/configuracoes.ts`) — decisão do usuário em 2026-09-21, confirmando a proposta:

```ts
export const CONFIGURACOES_PADRAO: Configuracoes = {
  metaSemanalDeFocoEmMinutos: 600,   // 10 h por semana
  metaSemanalDeTreinos: 3,
  orcamentoMensalEmCentavos: null,   // sem orcamento ate o usuario definir
  unidadeDePeso: 'kg',
  tema: 'sistema',
  onboardingConcluidoEm: null,
};
```

A especificação **não** define valores padrão: a seção 6.4 só diz que o onboarding pergunta metas, orçamento e unidades, e a 6.1 diz que, sem histórico de foco, a regra 7.2 "usa a meta semanal definida pelo usuário no onboarding". Como o onboarding só chega no item 5.3 e a tela Hoje existe desde a Fase 0 (D4), o app precisa de um comportamento definido no intervalo. A proposta é: **metas com padrão neutro e utilizável; orçamento `null`, porque não existe orçamento neutro** — inventar R$ 1.000 faria a Hoje exibir um "disponível para hoje" que o usuário nunca autorizou, e isso é pior do que exibir "defina seu orçamento". `unidadeDePeso` e `tema` seguem o que a especificação já manda (kg por padrão, tema do sistema).

`CONFIGURACOES_PADRAO` é a **única** constante de negócio fixa no código, e ela é o padrão da configuração — não um valor usado por regra. D4 continua valendo sem exceção: toda regra lê `Configuracoes`, nunca a constante.

#### 3.2 `historicoDeAcoes` — base do XP (item 0.12, D5)

| Campo | Tipo | Observação |
|---|---|---|
| `id` | `string` | UUID v7; ordena por ordem de gravação sem precisar de índice em `createdAt` |
| `createdAt` / `updatedAt` / `deletedAt` | | `createdAt` = quando a linha foi gravada |
| `tipo` | `TipoDeAcao` | união de literais `'<modulo>.<acao>'` — **indexado** |
| `modulo` | `IdDeModulo` | `'nucleo' \| 'treino' \| 'estudos' \| 'financas'` — **indexado** |
| `ocorridaEm` | `string` | instante ISO em UTC de **quando a ação aconteceu** (pode ser retroativo, ≠ `createdAt`) |
| `dia` | `string` | `AAAA-MM-DD` local, **derivado de `ocorridaEm`** — **indexado** |
| `referenciaId` | `string \| null` | id do registro que originou a ação (série, sessão, lançamento) |
| `quantidade` | `number \| null` | uma única grandeza inteira para o XP: minutos focados, séries, cards revisados |

Decisões:

- **Uma tabela só, no núcleo, para os quatro módulos.** Os pilares gravam chamando `registrarAcao` exportado por `@/modulos/nucleo` — a matriz do ADR 0002 permite pilar → núcleo, e a regra da especificação ("um módulo não acessa o armazenamento de outro") é respeitada porque o acesso é pela interface pública, não pela tabela. É o que D5 exige: o XP é uma função pura sobre uma sequência única de ações, e ele sobrevive a exportar e importar backup.
- **Sem texto livre e sem payload genérico.** `tipo` + `quantidade` + `referenciaId` bastam para o XP e mantêm o histórico livre de duplicar conteúdo do usuário (privacidade, princípio 4/5 e o que sai no CSV do item 0.6). Se uma fase precisar de mais, acrescenta campo com migração — não um `Record<string, unknown>`.
- **Invariante verificada na gravação:** `tipo` sempre começa com `${modulo}.`; `registrarAcao` lança se não começar. Barato e impede que o XP por pilar (5.2) some no módulo errado.
- **`TipoDeAcao` começa com um único membro real** e cada fase acrescenta os seus:

```ts
// src/modulos/nucleo/dominio/historico.ts
export type TipoDeAcao =
  | 'nucleo.configuracoesSalvas';
  // Fase 1 acrescenta 'treino.serieRegistrada', 'treino.cardioRegistrado', ...
```

  O `switch-exhaustiveness-check` do ESLint (já ligado) faz o cálculo de XP da Fase 5 falhar a compilação quando alguém acrescentar um tipo sem definir o peso. Uma união vazia não compila e um histórico sem nenhum escritor real seria código morto: por isso `salvarConfiguracoes` registra a sua ação (peso 0 no XP, invisível na interface). O efeito colateral é bom — dá ao item 0.5 o caso real de gravação atômica em duas tabelas.
- **Índices mínimos:** `dia` (heatmap, semana, sequência, XP por período), `tipo` e `modulo` (XP por pilar). Compostos (`[modulo+dia]`) e `referenciaId` **não** entram na v1 — entram na migração da fase que os usar, e acrescentar índice no Dexie é subir de versão sem função de upgrade.

#### 3.3 O que o backup enxerga

As duas tabelas entram no `contratoDeDados` do núcleo no **item 0.6** (hoje ele devolve `{}`). O item 0.5 não implementa export/import; ele deixa pronto: `TABELAS`, `emTransacao`, e o fato de todo registro ter a mesma forma base e ser serializável em JSON puro (sem `Date`, sem `undefined`, sem classe).

#### 3.4 Como se consulta soft delete

**Proibido `where('deletedAt')`.** O IndexedDB não indexa `null`: registros ativos simplesmente não existiriam no índice e a consulta devolveria só o lixo. O padrão é: consulta pelo índice de negócio (`dia`, `tipo`, `modulo`) e filtro em memória com `estaAtivo`/`apenasAtivos`. Para os volumes deste app (um usuário, alguns milhares de linhas por ano) isso é irrelevante em desempenho. Se um dia não for, a saída registrada é um campo `ativo: 0 | 1` indexado — não um índice em `deletedAt`.

### 4. `src/persistencia/migracoes/` — uma migração por arquivo

```ts
// src/persistencia/migracoes/tipos.ts
import type { Transaction } from 'dexie';

export interface Migracao {
  /** Versao do schema. Sequencial, comecando em 1, sem buracos. */
  readonly versao: number;
  /**
   * So o que MUDOU nesta versao (o Dexie acumula as versoes anteriores):
   * tabela nova, indice novo/removido, ou `null` para apagar a tabela.
   */
  readonly stores: Readonly<Record<string, string | null>>;
  /** So quando dado existente precisa ser transformado. */
  readonly upgrade?: (transacao: Transaction) => Promise<void>;
}
```

```ts
// src/persistencia/migracoes/index.ts
import { v1Inicial } from './v1-inicial';
import type { Migracao } from './tipos';

/** Ordem crescente e imutavel. Migracao publicada NUNCA e editada. */
export const MIGRACOES: readonly Migracao[] = [v1Inicial];

export const VERSAO_DO_SCHEMA = MIGRACOES.length; // === ultima versao, por construcao
export type { Migracao };
```

Regras para todas as fases seguintes:

1. **Um arquivo por versão**, `vN-<assunto>.ts`, exportando um `Migracao` com o mesmo nome em camelCase (`v2Treino`).
2. **Migração publicada é imutável.** Corrigir um erro de schema significa `v(N+1)`, nunca editar `vN` — o banco de quem já abriu o app está na versão antiga.
3. **`stores` declara só a diferença.** O Dexie herda as tabelas e índices das versões anteriores.
4. **`upgrade` só quando existe dado a transformar** (campo novo obrigatório, renomeação, mudança de unidade). Acrescentar tabela ou índice não precisa de `upgrade`.
5. **Dentro de `upgrade` só se usa `transacao.table('nome')`**, nunca `db.tabela` nem `tabela()` — a instância global não participa daquela transação de upgrade.
6. **A mesma entrega que acrescenta a migração acrescenta o nome da tabela em `TABELAS`, o tipo do registro no repositório do módulo e o teste da seção 7.** Faltou um dos quatro, o `revisor-critico` reprova.

### 5. `src/persistencia/transacao.ts` — gravação atômica (especificação, seção 8)

```ts
import { db } from './db';
import type { NomeDeTabela } from './db';

/**
 * Executa `operacao` numa transacao de leitura e escrita. Se `operacao` lancar,
 * NADA e gravado. Cuidados obrigatorios dentro da operacao:
 *  - so aguardar promessas do Dexie; `fetch`, `setTimeout` ou qualquer promessa
 *    de fora perde a zona da transacao e o Dexie a fecha antes da hora;
 *  - calcular ids, instantes e valores ANTES de entrar;
 *  - uma chamada aninhada so e absorvida pela transacao de fora se as tabelas
 *    dela forem um subconjunto das tabelas de fora.
 */
export function emTransacao<T>(
  tabelas: readonly NomeDeTabela[],
  operacao: () => Promise<T>,
): Promise<T> {
  return db.transaction('rw', tabelas as readonly string[], operacao);
}
```

- **Um helper só, modo `rw`.** A variante de leitura (`'r'` sobre todas as tabelas, para um export consistente) nasce no item 0.6, se ele precisar — não se cria abstração antes do segundo caso.
- **Toda escrita que toca mais de uma tabela passa por aqui.** Escrita de tabela única pode usar `put` direto (o IndexedDB já é atômico por operação).
- **Rollback é por exceção**: não existe "cancelar" explícito no contrato; quem quiser abortar lança.

### 6. Repositórios e domínio do núcleo

Divisão obrigatória (matriz do ADR 0002): `dominio/` é puro e **não** importa `@/persistencia`; `repositorio/` é quem conhece o banco. Por isso o tipo de negócio e o tipo persistido são dois:

```ts
// src/modulos/nucleo/dominio/configuracoes.ts  (puro)
export interface Configuracoes {
  metaSemanalDeFocoEmMinutos: number;
  metaSemanalDeTreinos: number;
  orcamentoMensalEmCentavos: number | null;
  unidadeDePeso: 'kg' | 'lb';
  tema: 'sistema' | 'claro' | 'escuro';
  onboardingConcluidoEm: string | null;
}
export type MudancasDeConfiguracoes = Partial<Configuracoes>;
export const CONFIGURACOES_PADRAO: Configuracoes;
/** Devolve a lista de problemas; vazia = valido. Mensagens sao de desenvolvedor. */
export function validarConfiguracoes(configuracoes: Configuracoes): string[];
/** Mescla puro, sem relogio e sem banco. */
export function aplicarMudancas(atuais: Configuracoes, mudancas: MudancasDeConfiguracoes): Configuracoes;
```

```ts
// src/modulos/nucleo/dominio/historico.ts  (puro)
export type TipoDeAcao = 'nucleo.configuracoesSalvas';
export interface AcaoDoHistorico {
  tipo: TipoDeAcao;
  modulo: IdDeModulo;
  ocorridaEm: string;
  dia: string;
  referenciaId: string | null;
  quantidade: number | null;
}
/** Entrada de quem registra: `dia` e derivado, `ocorridaEm` cai para agora. */
export interface EntradaDeAcao {
  tipo: TipoDeAcao;
  modulo: IdDeModulo;
  referenciaId: string | null;
  quantidade: number | null;
  ocorridaEm?: string;
}
export function moduloDoTipo(tipo: TipoDeAcao): IdDeModulo; // prefixo antes do ponto
```

```ts
// src/modulos/nucleo/repositorio/configuracoes.ts
type RegistroDeConfiguracoes = Configuracoes & RegistroBase;
export const ID_DAS_CONFIGURACOES = 'configuracoes-unicas';

/** Nunca grava. Sem linha no banco, devolve CONFIGURACOES_PADRAO. */
export function obterConfiguracoes(): Promise<Configuracoes>;

/**
 * Grava a mescla de `mudancas` sobre o que existe (ou sobre o padrao, na
 * primeira vez) e registra 'nucleo.configuracoesSalvas' na MESMA transacao.
 * Lanca se `validarConfiguracoes` reprovar; nesse caso nada e gravado.
 * Devolve as configuracoes ja gravadas.
 */
export function salvarConfiguracoes(mudancas: MudancasDeConfiguracoes): Promise<Configuracoes>;
```

```ts
// src/modulos/nucleo/repositorio/historico.ts
type RegistroDeAcao = AcaoDoHistorico & RegistroBase;

/** `dia` sai de `ocorridaEm`; lanca se `tipo` nao comecar com `${modulo}.`. */
export function registrarAcao(entrada: EntradaDeAcao): Promise<void>;

/** Dias inclusive, `AAAA-MM-DD`. So ativas, ordenadas por `ocorridaEm` e depois `id`. */
export function listarAcoesDoPeriodo(deDia: string, ateDia: string): Promise<AcaoDoHistorico[]>;

/** Soft delete: preenche `deletedAt`, mantem a linha. */
export function excluirAcao(id: string): Promise<void>;
```

```ts
// src/modulos/nucleo/repositorio/hooks.ts   (unico arquivo do dominio com React)
export function useConfiguracoes(): Configuracoes; // useLiveQuery(obterConfiguracoes, [], CONFIGURACOES_PADRAO)
```

E `src/modulos/nucleo/index.ts` passa a exportar, além do que já exporta:

```ts
export type { Configuracoes, MudancasDeConfiguracoes, AcaoDoHistorico, EntradaDeAcao, TipoDeAcao } from './dominio/...';
export { CONFIGURACOES_PADRAO } from './dominio/configuracoes';
export { obterConfiguracoes, salvarConfiguracoes } from './repositorio/configuracoes';
export { registrarAcao, listarAcoesDoPeriodo, excluirAcao } from './repositorio/historico';
export { useConfiguracoes } from './repositorio/hooks';
```

Notas de contrato:

- **`obterConfiguracoes` não grava nada.** Gravar no primeiro `get` criaria uma linha "do usuário" que o usuário nunca tocou, e o `onboardingConcluidoEm` perderia o sentido. A linha nasce no primeiro `salvarConfiguracoes`.
- **`useConfiguracoes` nunca devolve `undefined`**: o terceiro argumento do `useLiveQuery` é `CONFIGURACOES_PADRAO`, o mesmo valor que o repositório devolveria. A tela do item 0.10 não precisa de estado de carregamento para isto.
- **`Partial<Configuracoes>` com `exactOptionalPropertyTypes`** significa que o chamador omite a chave; passar `{ tema: undefined }` é erro de compilação. É o comportamento desejado.
- **A transação de `salvarConfiguracoes` declara as duas tabelas** (`['configuracoes', 'historicoDeAcoes']`) justamente para absorver o `registrarAcao` aninhado (regra da seção 5).
- **`solicitarArmazenamentoPersistente()`** (`src/persistencia/armazenamento.ts`): `navigator.storage?.persist?.()` com detecção de recurso, devolvendo `false` quando a API não existe. Não é chamada aqui — quem chama é a casca do app no **item 0.7**, que é do agente `interface` e não pode criar arquivo em `persistencia/`. É a mitigação do risco técnico 3 decidida em D1.

### 7. Isolamento nos testes — pendência 17 fechada

A pendência 17 oferecia duas saídas; a primeira não funciona como escrita, porque o Dexie resolve a fábrica de IndexedDB **no construtor** (Contexto, fato 1): a instância `db` já existe quando o `beforeEach` troca `globalThis.indexedDB`. A decisão é usar a mesma ideia pelo caminho que o Dexie suporta oficialmente — passar a fábrica na construção — e nunca mexer no nome do banco:

| Tipo de teste | Isolamento | Por quê |
|---|---|---|
| Schema e migrações (`src/persistencia/**/*.test.ts`) | `const banco = criarBanco({ indexedDB: new IDBFactory() })`, `banco.close()` no `afterEach` | Cada teste recebe um universo de IndexedDB virgem, com o **nome real e fixo** do banco e o **schema real**. Limpeza de graça: a fábrica é descartada com o teste. |
| Repositórios (`src/modulos/*/repositorio/*.test.ts`) | `beforeEach`: `await Promise.all(db.tables.map((t) => t.clear()))` | O repositório importa a instância única `db`; injetar banco em cada função só para o teste seria abstração para um caso só. O Vitest já isola por arquivo, e limpar as tabelas isola dentro do arquivo. |

Regras fechadas para o `testador`:

1. **Nome de banco nunca é parâmetro de teste.** `NOME_DO_BANCO` é constante; quem varia é a fábrica.
2. `IDBKeyRange` continua vindo do global que o `vitest.setup.ts` instala (`fake-indexeddb/auto`) — chaves são compatíveis entre fábricas; só `indexedDB` precisa ser trocado.
3. `src/persistencia/ambiente.test.ts` **é adaptado, não apagado**: continua sendo a prova de que a ferramenta funciona (inclusive `version().upgrade()`, que nenhum teste real exercita até a Fase 1 existir), mas passa a usar `new IDBFactory()` em vez de nome de banco sorteado, para não deixar no repositório um padrão que a pendência 17 proíbe copiar. O comentário do topo passa a apontar este ADR.
4. Testes que dependem de data de calendário fixam o relógio com `vi.useFakeTimers()` / `vi.setSystemTime()` **e** rodam com `TZ=America/Sao_Paulo` (o `dominio` acrescenta `test.env = { TZ: 'America/Sao_Paulo' }` no `vitest.config.ts`). Se o Vitest não aplicar o `TZ` na versão instalada, o `testador` reporta e o teste de fuso passa a construir os instantes explicitamente, em vez de depender da máquina.

Testes que o item 0.5 exige (o `testador` escreve; os critérios da seção 9 dizem o que cada um prova):

| Arquivo | Cobre |
|---|---|
| `src/persistencia/tipos.test.ts` | `criarRegistro`/`atualizarRegistro`/`marcarComoExcluido`/`apenasAtivos` |
| `src/persistencia/migracoes/v1-inicial.test.ts` | criação do schema v1, índices, `verno`, sobrevivência a fechar e reabrir |
| `src/persistencia/transacao.test.ts` | commit e **rollback** em duas tabelas |
| `src/compartilhado/datas.test.ts` | `dataDeCalendarioDe` no limite do fuso (23h30 local ≠ dia UTC) |
| `src/modulos/nucleo/dominio/configuracoes.test.ts` | `validarConfiguracoes`, `aplicarMudancas` |
| `src/modulos/nucleo/repositorio/configuracoes.test.ts` | primeira leitura sem gravar, primeira gravação, mescla, atomicidade com o histórico |
| `src/modulos/nucleo/repositorio/historico.test.ts` | registrar, listar por período, soft delete, invariante do prefixo do `tipo` |

### 8. Quem faz o quê

| Agente | Arquivos |
|---|---|
| `dominio` | `src/persistencia/{db,tipos,transacao,armazenamento,index}.ts`, `src/persistencia/migracoes/{tipos,index,v1-inicial}.ts`, `src/compartilhado/datas.ts` (+ `index.ts`), `src/modulos/nucleo/dominio/{configuracoes,historico}.ts`, `src/modulos/nucleo/repositorio/{configuracoes,historico,hooks}.ts`, `src/modulos/nucleo/index.ts`, `vitest.config.ts` (só a linha do `TZ`) |
| `testador` | os sete arquivos de teste da seção 7 e a adaptação do `ambiente.test.ts` |
| `interface` | **nada neste item.** A tela de Configurações é o item 0.10 e consome `useConfiguracoes` + `salvarConfiguracoes` |

Nenhum `.gitkeep` sobrevive em pasta que passou a ter arquivo (`src/persistencia/migracoes/`, `src/modulos/nucleo/repositorio/`).

### 9. Critérios de aceite do item 0.5

O item só está pronto quando todos passarem:

1. `npm run verificar` termina com código 0 (lint, format, typecheck, unit, build).
2. `src/persistencia/index.ts` exporta exatamente o que a seção 1 lista; nenhum arquivo fora de `*/repositorio/**` importa `@/persistencia` (o lint do ADR 0002 já barra; conferir que não houve `eslint-disable`).
3. **Schema v1 criado:** abrir um banco novo (`criarBanco({ indexedDB: new IDBFactory() })`) resulta em `banco.verno === 1`, tabelas exatamente `['configuracoes', 'historicoDeAcoes']`, e os índices de `historicoDeAcoes` exatamente `dia`, `tipo`, `modulo` (comparação da lista, não `toContain`).
4. **Sobrevive a fechar e reabrir:** gravar, `close()`, abrir outra instância na **mesma fábrica** e o registro continua lá, idêntico.
5. **Transação atômica:** `emTransacao(['configuracoes', 'historicoDeAcoes'], ...)` que grava nas duas e lança no fim deixa as **duas** tabelas como estavam (asserção nas duas), e a promessa rejeita.
6. **Atomicidade no caminho real:** `salvarConfiguracoes` com entrada inválida (ex.: `metaSemanalDeTreinos: -1`) rejeita e não grava nem configuração nem ação; com entrada válida, grava **uma** configuração e **uma** ação do histórico.
7. **Leitura sem efeito colateral:** `obterConfiguracoes()` num banco vazio devolve `CONFIGURACOES_PADRAO` e `db.table('configuracoes').count()` continua `0`.
8. **CRUD + soft delete do histórico:** registrar 3 ações em dias diferentes; `listarAcoesDoPeriodo` devolve as do intervalo, na ordem; `excluirAcao` numa delas faz a listagem devolver 2 **e** a consulta direta à tabela ainda devolver 3 linhas, a excluída com `deletedAt` preenchido e `updatedAt` alterado.
9. **Campos de controle:** `createdAt` não muda numa atualização, `updatedAt` muda, `id` é UUID v7 e dois registros criados em sequência ordenam crescente por `id`.
10. **Invariantes:** `registrarAcao` rejeita `tipo` cujo prefixo não bate com `modulo`; `salvarConfiguracoes` sempre grava na linha `ID_DAS_CONFIGURACOES` (contagem da tabela nunca passa de 1, mesmo com duas gravações seguidas).
11. **Fuso:** com o relógio fixado em `2026-09-21T23:30:00` de `America/Sao_Paulo`, `dia` da ação é `2026-09-21` (e não `2026-09-22`).
12. **Nenhuma consulta usa `deletedAt` como índice:** busca por `where('deletedAt'` e por `'deletedAt'` dentro de `stores` não encontra nada em `src/`.
13. `src/persistencia/ambiente.test.ts` não usa mais nome de banco sorteado (pendência 17 fechada) e continua verde.
14. **Nenhuma dependência nova:** `npm ls --depth=0` idêntico ao do item 0.4.
15. Cobertura do Vitest (já apontada para `src/**/dominio/**` e `src/persistencia/**`) é gerada sem erro e vai no relatório; nenhum arquivo de `src/persistencia/` fica com 0%.
16. `docs/PLANO.md` atualizado: item 0.5 pronto, pendência 17 fechada apontando para este ADR, e toda suposição não bloqueante registrada.
17. `git status` limpo depois do commit.

Sem e2e neste item: não há tela. A parte de "sobrevive ao fechamento do app" que a Definition of Done pede em fluxo real é coberta no item 0.10/0.11, quando existir tela para fechar.

### 10. Entrega para o item 0.6 e o que fica de fora

Pronto para o 0.6 usar sem inventar nada: `TABELAS`, `emTransacao`, forma uniforme dos registros (JSON puro, sem `Date`, sem `undefined`), e a regra de que o backup exporta **inclusive** os soft-deleted (ADR 0002, seção 3).

Fica explicitamente fora do item 0.5:

- `contratoDeDados` real do núcleo (exportar/importar/apagar tudo) — item 0.6.
- `excluirAcoesDoModulo(modulo)` e `excluirAcoesDaReferencia(referenciaId)` (com o índice em `referenciaId`) — nascem com o primeiro pilar que precisar apagar em cascata, na Fase 1.
- Purga de registros soft-deleted, backup automático local e "últimas N cópias" — item 5.4.
- Qualquer tabela de pilar, configuração de Pomodoro, faixas da regra 7.7 e dias de aviso de assinatura — cada uma na migração da sua fase.
- Semente de dados de desenvolvimento (especificação, seção 9) — quando houver tela que a justifique.

## Alternativas consideradas

- **Trocar `globalThis.indexedDB` por `new IDBFactory()` no `beforeEach`** (opção 1 da pendência 17). Não funciona para a instância única, que já capturou a fábrica na importação; funcionaria só com `vi.resetModules()` + `await import(...)` dinâmico em cada teste, o que é ruído em todo arquivo de teste de persistência daqui até a Fase 5. A fábrica passada em `criarBanco` entrega o mesmo isolamento pela porta da frente.
- **Repositório recebendo o nome do banco por parâmetro** (opção 2 da pendência 17). Rejeitada: o nome passaria a ser configuração de produção só para servir a teste, e um erro de digitação em produção abriria um banco vazio sem nenhum sintoma. Isolar pela fábrica mantém o nome constante e ainda testa o nome real.
- **Injeção de dependência: cada função de repositório recebendo `db`.** Isolaria tudo sem truque, ao custo de um parâmetro em cada assinatura pública e de vazar infraestrutura para o `index.ts` do módulo. Abstração para um caso só (o teste), proibida pelo `CLAUDE.md`.
- **Configurações como tabela chave-valor** (`{ chave, valor }`). Sobrevive a mudança de campo sem migração, mas destrói a tipagem (valor vira `unknown`), espalha validação e transforma "salvar configurações" numa escrita de N linhas. Com linha única e migração versionada, a tipagem é total e a mudança de schema é explícita — que é o que a seção 5 da especificação pede.
- **Configurações em `localStorage`.** Seria síncrono e simplificaria o boot do tema, mas quebraria backup/importação uniformes, ficaria fora das transações e é o primeiro armazenamento que o Safari limpa (risco técnico 3).
- **Uma tabela de histórico por módulo.** Deixaria cada pilar dono do seu dado, mas o XP (D5) teria de juntar quatro tabelas para cada cálculo, e o heatmap de "ações do dia" na Hoje viraria quatro consultas. A tabela única no núcleo com índice em `modulo` dá a mesma separação lógica com uma consulta só.
- **`payload: Record<string, unknown>` no histórico.** Resolveria qualquer necessidade futura sem migração — e por isso mesmo viraria depósito de dado não tipado, não validado e não testado, com risco de duplicar conteúdo do usuário no CSV. `tipo` + `quantidade` + `referenciaId` cobrem o XP; o que faltar entra como campo com migração.
- **Índice em `deletedAt` para separar ativos.** Impossível pelo comportamento do IndexedDB com `null` (Contexto, fato 2). A alternativa real, se o volume exigir, é um campo `ativo: 0 | 1`; hoje seria estado duplicado sem necessidade.
- **`id` das configurações em UUID v7**, mantendo a convenção sem exceção. Permitiria duas linhas de configuração (duas abas, importação de backup) e o app teria de escolher uma. Chave sentinela fixa torna `put` idempotente.
- **Guardar peso em kg decimal.** Ponto flutuante em campo de banco reabre o problema que a especificação já resolveu para dinheiro (2,5 kg + 2,5 kg com conversão para lb e volta). Gramas inteiros na Fase 1.
- **Migrações declaradas direto no `db.ts`.** Menos arquivos, mas em três fases o arquivo vira uma pilha de `version()` e o teste de cada versão perde endereço. Um arquivo por versão com um registro central é o que o ADR 0002 já previa.
- **Apagar `src/persistencia/ambiente.test.ts`.** Legítimo (ele se dizia descartável), mas deixaria `version().upgrade()` sem nenhum teste até a Fase 1 criar a v2 — e é justamente o mecanismo que a seção 9 da especificação manda testar. Custa menos adaptá-lo do que ficar sem.

## Consequências

- Cada fase seguinte tem um roteiro fixo de persistência: arquivo `vN-*.ts`, nome em `TABELAS`, tipo `Registro* = Entidade & RegistroBase` no repositório, teste de migração. Nada disso volta a ser decidido caso a caso.
- Nenhum repositório escreve `id`, `createdAt`, `updatedAt` ou `deletedAt` na mão. Um erro de convenção passa a ser erro de tipo, não de revisão.
- O histórico único no núcleo faz o XP da Fase 5 ser uma função pura sobre uma lista — e faz cada pilar depender do núcleo para registrar ação, o que já era a direção da matriz de imports.
- Preço a pagar: dois tipos por entidade (o de negócio, puro, e o persistido com `RegistroBase`), por causa da regra de que `dominio/` não importa `persistencia`. É uma linha de `type X = Y & RegistroBase` por tabela, e mantém as regras da seção 7 testáveis sem banco.
- `obterConfiguracoes` devolvendo o padrão sem gravar significa que toda tela e toda regra precisa tratar `orcamentoMensalEmCentavos === null` como "sem orçamento". Isso é requisito da Hoje (0.11) e da regra 7.3 (Fase 4), e entra nos critérios de aceite desses itens.
- O nome do banco vira imutável na prática a partir do primeiro uso real. Trocar depois exige código de migração de dados — daí a pergunta bloqueante agora.
- Multi-aba fica no comportamento padrão do Dexie (a aba antiga fecha a conexão numa mudança de versão). Se virar problema visível, entra tratamento explícito no item 0.7.
- A cobertura do Vitest passa a ter conteúdo real em `src/persistencia/**`, que é o que o `revisor-critico` olha primeiro daqui em diante.

## Pendências

### Bloqueantes (o item não é implementado antes da resposta)

1. **Valores padrão das configurações antes do onboarding** (seção 3.1). A especificação não define nenhum e o onboarding só chega no item 5.3, mas a tela Hoje existe desde a Fase 0.
2. **Nome técnico do banco no dispositivo** (seção 1). Invisível ao usuário, mas imutável na prática depois que houver dado.

### Não bloqueantes (suposições que seguem se não houver resposta)

1. Soft delete **nunca é purgado** automaticamente: registro excluído fica no banco e sai no backup marcado com `deletedAt`. É o que permite desfazer (seção 5 da especificação) e o volume é irrelevante num app de um usuário. Uma ação de "esvaziar excluídos" pode entrar no item 0.6 se o usuário pedir.
2. `salvarConfiguracoes` grava a ação `nucleo.configuracoesSalvas` no histórico, com peso 0 no XP. Serve para o item 0.12 ter um escritor real e testado; se soar como ruído, sai sem alterar schema.
3. O orçamento mensal é **um valor único** na configuração, não um valor por mês. Alterar o orçamento muda o cálculo de meses passados. Se a Fase 4 precisar de orçamento por mês, ela acrescenta uma tabela própria e este campo vira o padrão.
4. Grandezas com fração viram inteiro na menor unidade (peso em gramas, distância em metros, tempo em minutos ou segundos). `unidadeDePeso` é preferência de exibição.
5. Índices compostos e o índice em `referenciaId` ficam para a fase que os usar.
6. `vitest.config.ts` passa a fixar `TZ=America/Sao_Paulo` nos testes, para que data de calendário não dependa da máquina.

## Fontes consultadas em 21/09/2026

- Dexie — construtor e opções (`indexedDB`, `IDBKeyRange`, `autoOpen`, `addons`, `cache`): <https://dexie.org/docs/Dexie/Dexie>
- Dexie — `db.transaction(mode, tables, callback)`, modos, rollback por exceção e reutilização de transação pai: <https://dexie.org/docs/Dexie/Dexie.transaction()>
- `fake-indexeddb` — isolamento com `new IDBFactory()` e uso com Dexie (`Dexie.dependencies` ou opções do construtor): <https://github.com/dumbmatter/fakeIndexedDB>
- IndexedDB — chaves válidas e registros silenciosamente fora do índice quando o `keyPath` não produz chave válida (`null`/`undefined`/boolean): <https://www.w3.org/TR/IndexedDB-2/> e <https://developer.mozilla.org/en-US/docs/Web/API/IDBIndex/keyPath>
- RFC 9562 (UUID v7, ordenação temporal) — já implementado em `src/compartilhado/identificador.ts` no item 0.2.
