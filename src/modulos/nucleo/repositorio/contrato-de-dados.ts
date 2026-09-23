import { dataDeCalendarioDe } from '@/compartilhado';
import { apenasAtivos, tabela } from '@/persistencia';
import type { RegistroBase } from '@/persistencia';
import { ErroDeBackup, montarCsv } from '../dominio/backup';
import type { ColunaCsv } from '../dominio/backup';
import { validarConfiguracoes } from '../dominio/configuracoes';
import type { Configuracoes } from '../dominio/configuracoes';
import type { AcaoDoHistorico } from '../dominio/historico';
import type { ArquivoCsv, ContratoDeDadosDeModulo, IdDeModulo } from '../tipos';
import { ID_DAS_CONFIGURACOES } from './configuracoes';

/**
 * O núcleo como módulo do backup (ADR 0006, seção 4.3): separado do
 * orquestrador (`repositorio/backup.ts`) de propósito — um arquivo é "o
 * núcleo participando do backup", o outro é "o núcleo coordenando o backup
 * de todos".
 */

type RegistroDeConfiguracoes = Configuracoes & RegistroBase;
type RegistroDeAcao = AcaoDoHistorico & RegistroBase;

const NOMES_DE_TABELA_DO_NUCLEO = ['configuracoes', 'historicoDeAcoes'] as const;
const UNIDADES_DE_PESO = ['kg', 'lb'] as const;
const TEMAS = ['sistema', 'claro', 'escuro'] as const;
const IDS_DE_MODULO: readonly IdDeModulo[] = ['nucleo', 'treino', 'estudos', 'financas'];

/** As 6 chaves de `Configuracoes` (ADR 0005). Usado para exigir presença explícita. */
const CHAVES_DE_CONFIGURACOES = [
  'metaSemanalDeFocoEmMinutos',
  'metaSemanalDeTreinos',
  'orcamentoMensalEmCentavos',
  'unidadeDePeso',
  'tema',
  'onboardingConcluidoEm',
] as const;

function tabelaDeConfiguracoes() {
  return tabela<RegistroDeConfiguracoes>('configuracoes');
}

function tabelaDeAcoes() {
  return tabela<RegistroDeAcao>('historicoDeAcoes');
}

function compararPorId(a: RegistroBase, b: RegistroBase): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Cada tabela sai ordenada por `id` crescente (ADR 0006, seção 1, regra 2). */
function ordenarPorId<T extends RegistroBase>(registros: readonly T[]): T[] {
  return [...registros].sort(compararPorId);
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function ehInstanteIso(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;
  try {
    dataDeCalendarioDe(valor);
    return true;
  } catch {
    return false;
  }
}

function ehDiaDeCalendario(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

function ehIdDeModulo(valor: unknown): valor is IdDeModulo {
  return typeof valor === 'string' && (IDS_DE_MODULO as readonly string[]).includes(valor);
}

/**
 * Validação de negócio de `configuracoes` (ADR 0006, seção 4.3): no máximo
 * uma linha (checado pelo chamador), `id` igual ao sentinela, as 6 chaves de
 * `Configuracoes` presentes explicitamente, `validarConfiguracoes` sem
 * problemas, `unidadeDePeso`/`tema` dentro das uniões e `onboardingConcluidoEm`
 * igual a `null` ou instante ISO. A forma de `RegistroBase`
 * (id/createdAt/updatedAt/deletedAt) já foi validada na camada de envelope
 * (`lerBackup`); aqui só o de negócio.
 */
function validarLinhaDeConfiguracoes(item: unknown, indice: number): RegistroDeConfiguracoes {
  if (!ehObjeto(item)) {
    throw new ErroDeBackup('registroInvalido', `configuracoes[${String(indice)}] nao e um objeto.`);
  }
  if (item['id'] !== ID_DAS_CONFIGURACOES) {
    throw new ErroDeBackup(
      'registroInvalido',
      `configuracoes[${String(indice)}].id deveria ser "${ID_DAS_CONFIGURACOES}".`,
    );
  }

  for (const chave of CHAVES_DE_CONFIGURACOES) {
    if (!(chave in item)) {
      throw new ErroDeBackup(
        'registroInvalido',
        `configuracoes[${String(indice)}].${chave} ausente.`,
      );
    }
  }

  const candidato = item as unknown as RegistroDeConfiguracoes;

  if (!(UNIDADES_DE_PESO as readonly string[]).includes(candidato.unidadeDePeso)) {
    throw new ErroDeBackup(
      'registroInvalido',
      `configuracoes[${String(indice)}].unidadeDePeso invalida.`,
    );
  }
  if (!(TEMAS as readonly string[]).includes(candidato.tema)) {
    throw new ErroDeBackup('registroInvalido', `configuracoes[${String(indice)}].tema invalido.`);
  }
  if (candidato.onboardingConcluidoEm !== null && !ehInstanteIso(candidato.onboardingConcluidoEm)) {
    throw new ErroDeBackup(
      'registroInvalido',
      `configuracoes[${String(indice)}].onboardingConcluidoEm invalido.`,
    );
  }

  const problemas = validarConfiguracoes(candidato);
  if (problemas.length > 0) {
    throw new ErroDeBackup(
      'registroInvalido',
      `configuracoes[${String(indice)}]: ${problemas.join('; ')}`,
    );
  }

  return candidato;
}

/**
 * Validação de negócio de `historicoDeAcoes` (ADR 0006, seção 4.3): `modulo`
 * pertence a `IdDeModulo`; `tipo` começa com `${modulo}.` seguido de pelo
 * menos um caractere (invariante do ADR 0005, seção 3.2, a mesma que
 * `registrarAcao` já exige na gravação normal — a importação não pode ser
 * mais permissiva) — `tipo` fora de `TipoDeAcao` é ACEITO se respeitar essa
 * invariante; `dia` casa `AAAA-MM-DD`; `ocorridaEm` é instante ISO;
 * `quantidade` é `null` ou inteiro; `referenciaId` é `null` ou string.
 */
function validarLinhaDeAcao(item: unknown, indice: number): RegistroDeAcao {
  if (!ehObjeto(item)) {
    throw new ErroDeBackup(
      'registroInvalido',
      `historicoDeAcoes[${String(indice)}] nao e um objeto.`,
    );
  }

  const tipo = item['tipo'];
  const modulo = item['modulo'];
  const dia = item['dia'];
  const ocorridaEm = item['ocorridaEm'];
  const quantidade = item['quantidade'];
  const referenciaId = item['referenciaId'];

  if (typeof tipo !== 'string' || tipo.length === 0) {
    throw new ErroDeBackup(
      'registroInvalido',
      `historicoDeAcoes[${String(indice)}].tipo ausente ou invalido.`,
    );
  }
  if (!ehIdDeModulo(modulo)) {
    throw new ErroDeBackup(
      'registroInvalido',
      `historicoDeAcoes[${String(indice)}].modulo desconhecido.`,
    );
  }
  if (!tipo.startsWith(`${modulo}.`) || tipo.length <= modulo.length + 1) {
    throw new ErroDeBackup(
      'registroInvalido',
      `historicoDeAcoes[${String(indice)}].tipo "${tipo}" nao pertence ao modulo "${modulo}".`,
    );
  }
  if (!ehDiaDeCalendario(dia)) {
    throw new ErroDeBackup('registroInvalido', `historicoDeAcoes[${String(indice)}].dia invalido.`);
  }
  if (!ehInstanteIso(ocorridaEm)) {
    throw new ErroDeBackup(
      'registroInvalido',
      `historicoDeAcoes[${String(indice)}].ocorridaEm invalido.`,
    );
  }
  if (quantidade !== null && !Number.isInteger(quantidade)) {
    throw new ErroDeBackup(
      'registroInvalido',
      `historicoDeAcoes[${String(indice)}].quantidade deve ser null ou inteiro.`,
    );
  }
  if (referenciaId !== null && typeof referenciaId !== 'string') {
    throw new ErroDeBackup(
      'registroInvalido',
      `historicoDeAcoes[${String(indice)}].referenciaId deve ser null ou string.`,
    );
  }

  return item as unknown as RegistroDeAcao;
}

/** Colunas do CSV (ADR 0006, seção 3.4), nome técnico do campo no cabeçalho. */
const COLUNAS_DE_CONFIGURACOES: readonly ColunaCsv<RegistroDeConfiguracoes>[] = [
  { titulo: 'id', valor: (r) => r.id },
  { titulo: 'createdAt', valor: (r) => r.createdAt },
  { titulo: 'updatedAt', valor: (r) => r.updatedAt },
  { titulo: 'metaSemanalDeFocoEmMinutos', valor: (r) => r.metaSemanalDeFocoEmMinutos },
  { titulo: 'metaSemanalDeTreinos', valor: (r) => r.metaSemanalDeTreinos },
  { titulo: 'orcamentoMensalEmCentavos', valor: (r) => r.orcamentoMensalEmCentavos },
  { titulo: 'unidadeDePeso', valor: (r) => r.unidadeDePeso },
  { titulo: 'tema', valor: (r) => r.tema },
  { titulo: 'onboardingConcluidoEm', valor: (r) => r.onboardingConcluidoEm },
];

const COLUNAS_DE_HISTORICO: readonly ColunaCsv<RegistroDeAcao>[] = [
  { titulo: 'id', valor: (r) => r.id },
  { titulo: 'createdAt', valor: (r) => r.createdAt },
  { titulo: 'ocorridaEm', valor: (r) => r.ocorridaEm },
  { titulo: 'dia', valor: (r) => r.dia },
  { titulo: 'modulo', valor: (r) => r.modulo },
  { titulo: 'tipo', valor: (r) => r.tipo },
  { titulo: 'quantidade', valor: (r) => r.quantidade },
  { titulo: 'referenciaId', valor: (r) => r.referenciaId },
];

/** Devolve TODA linha de toda tabela, inclusive soft-deleted, ordenada por `id`. */
async function exportarJson(): Promise<Record<string, readonly unknown[]>> {
  const configuracoes = await tabelaDeConfiguracoes().toArray();
  const historicoDeAcoes = await tabelaDeAcoes().toArray();
  return {
    configuracoes: ordenarPorId(configuracoes),
    historicoDeAcoes: ordenarPorId(historicoDeAcoes),
  };
}

/**
 * Substituição total (ADR 0006, seção 4.2, regras 3 a 5): limpa as duas
 * tabelas e grava o que veio, depois de validar. Chave de tabela desconhecida
 * lança em vez de ignorar. Grava o registro como está no arquivo — nunca usa
 * `criarRegistro`/`atualizarRegistro`/`marcarComoExcluido`.
 */
async function importarJson(dados: Record<string, readonly unknown[]>): Promise<void> {
  for (const chave of Object.keys(dados)) {
    if (!(NOMES_DE_TABELA_DO_NUCLEO as readonly string[]).includes(chave)) {
      throw new ErroDeBackup(
        'registroInvalido',
        `Tabela desconhecida no modulo nucleo: "${chave}".`,
      );
    }
  }

  const linhasDeConfiguracoes = (dados['configuracoes'] ?? []).map((item, indice) =>
    validarLinhaDeConfiguracoes(item, indice),
  );
  if (linhasDeConfiguracoes.length > 1) {
    throw new ErroDeBackup('registroInvalido', 'configuracoes deve ter no maximo uma linha.');
  }

  const linhasDeHistorico = (dados['historicoDeAcoes'] ?? []).map((item, indice) =>
    validarLinhaDeAcao(item, indice),
  );

  await tabelaDeConfiguracoes().clear();
  await tabelaDeAcoes().clear();

  if (linhasDeConfiguracoes.length > 0) {
    await tabelaDeConfiguracoes().bulkPut(linhasDeConfiguracoes);
  }
  if (linhasDeHistorico.length > 0) {
    await tabelaDeAcoes().bulkPut(linhasDeHistorico);
  }
}

/** Só linhas ativas (ADR 0006, seção 3.3), ordenadas por `id`. */
async function exportarCsv(): Promise<readonly ArquivoCsv[]> {
  const configuracoes = ordenarPorId(apenasAtivos(await tabelaDeConfiguracoes().toArray()));
  const historicoDeAcoes = ordenarPorId(apenasAtivos(await tabelaDeAcoes().toArray()));

  return [
    {
      nome: 'nucleo-configuracoes.csv',
      conteudo: montarCsv(COLUNAS_DE_CONFIGURACOES, configuracoes),
    },
    {
      nome: 'nucleo-historico-de-acoes.csv',
      conteudo: montarCsv(COLUNAS_DE_HISTORICO, historicoDeAcoes),
    },
  ];
}

/** `clear()` físico nas duas tabelas do núcleo. Não grava nada. */
async function apagarTudoDoNucleo(): Promise<void> {
  await tabelaDeConfiguracoes().clear();
  await tabelaDeAcoes().clear();
}

export const contratoDeDadosDoNucleo: ContratoDeDadosDeModulo = {
  modulo: 'nucleo',
  exportarJson,
  importarJson,
  exportarCsv,
  apagarTudo: apagarTudoDoNucleo,
};
