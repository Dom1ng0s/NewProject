import { agoraEmIso, ehDataDeCalendarioValida, gerarIdentificador } from '@/compartilhado';
import { ErroDeBackup, montarCsv } from '@/modulos/nucleo';
import type { ArquivoCsv, ColunaCsv, ContratoDeDadosDeModulo } from '@/modulos/nucleo';
import { apenasAtivos, tabela } from '@/persistencia';
import type { RegistroBase } from '@/persistencia';
import { NOMES_DE_CATEGORIAS_INICIAIS, problemaDeNomeDeCategoria } from '../dominio/categorias';
import { problemasDeLancamento } from '../dominio/lancamentos';
import type { DadosDeLancamento, TipoDeLancamento } from '../dominio/lancamentos';
import type {
  DadosDeAssinatura,
  DadosDeUsoDeAssinatura,
  Periodicidade,
} from '../dominio/assinaturas';
import type { DadosDeCofrinho, DadosDeMovimentoDeCofrinho } from '../dominio/cofrinhos';

/**
 * O financas como módulo do backup (mesmo padrão de
 * `src/modulos/nucleo/repositorio/contrato-de-dados.ts`, ADR 0006, seção
 * 4.3): as seis tabelas do pilar entram inteiras no JSON (inclusive
 * soft-deleted); só `categorias` e `lancamentos` — as duas com tela nesta
 * entrega (item 1.1) — saem em CSV (contrato da tarefa: "lançamentos no
 * mínimo"). `assinaturas`/`usosDeAssinatura`/`cofrinhos`/`movimentosDeCofrinho`
 * só ganham tela nos itens 1.3 e 1.5; aqui elas só participam do
 * backup/apagar-tudo para o schema não ficar invisível para quem restaura um
 * arquivo com essas tabelas preenchidas por uma versão futura do app.
 */

interface DadosDeCategoria {
  readonly nome: string;
}

type RegistroDeCategoria = DadosDeCategoria & RegistroBase;
type RegistroDeLancamento = DadosDeLancamento & RegistroBase;
type RegistroDeAssinatura = DadosDeAssinatura & RegistroBase;
type RegistroDeUsoDeAssinatura = DadosDeUsoDeAssinatura & RegistroBase;
type RegistroDeCofrinho = DadosDeCofrinho & RegistroBase;
type RegistroDeMovimentoDeCofrinho = DadosDeMovimentoDeCofrinho & RegistroBase;

const NOMES_DE_TABELA_DO_FINANCAS = [
  'categorias',
  'lancamentos',
  'assinaturas',
  'usosDeAssinatura',
  'cofrinhos',
  'movimentosDeCofrinho',
] as const;

const PERIODICIDADES: readonly Periodicidade[] = ['mensal', 'anual'];
const TIPOS_DE_LANCAMENTO = ['gasto', 'entrada'] as const;

function tabelaDeCategorias() {
  return tabela<RegistroDeCategoria>('categorias');
}
function tabelaDeLancamentos() {
  return tabela<RegistroDeLancamento>('lancamentos');
}
function tabelaDeAssinaturas() {
  return tabela<RegistroDeAssinatura>('assinaturas');
}
function tabelaDeUsosDeAssinatura() {
  return tabela<RegistroDeUsoDeAssinatura>('usosDeAssinatura');
}
function tabelaDeCofrinhos() {
  return tabela<RegistroDeCofrinho>('cofrinhos');
}
function tabelaDeMovimentosDeCofrinho() {
  return tabela<RegistroDeMovimentoDeCofrinho>('movimentosDeCofrinho');
}

function compararPorId(a: RegistroBase, b: RegistroBase): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function ordenarPorId<T extends RegistroBase>(registros: readonly T[]): T[] {
  return [...registros].sort(compararPorId);
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function ehTipoDeLancamento(valor: unknown): valor is TipoDeLancamento {
  return typeof valor === 'string' && (TIPOS_DE_LANCAMENTO as readonly string[]).includes(valor);
}

function validarLinhaDeCategoria(item: unknown, indice: number): RegistroDeCategoria {
  if (!ehObjeto(item)) {
    throw new ErroDeBackup('registroInvalido', `categorias[${String(indice)}] nao e um objeto.`);
  }
  const nome = item['nome'];
  if (typeof nome !== 'string' || problemaDeNomeDeCategoria(nome) !== null) {
    throw new ErroDeBackup('registroInvalido', `categorias[${String(indice)}].nome invalido.`);
  }
  return item as unknown as RegistroDeCategoria;
}

function validarLinhaDeLancamento(item: unknown, indice: number): RegistroDeLancamento {
  if (!ehObjeto(item)) {
    throw new ErroDeBackup('registroInvalido', `lancamentos[${String(indice)}] nao e um objeto.`);
  }
  const tipo = item['tipo'];
  const valorCentavos = item['valorCentavos'];
  const categoriaId = item['categoriaId'];
  const descricao = item['descricao'];
  const data = item['data'];
  const assinaturaId = item['assinaturaId'];

  if (!ehTipoDeLancamento(tipo)) {
    throw new ErroDeBackup('registroInvalido', `lancamentos[${String(indice)}].tipo invalido.`);
  }
  if (typeof valorCentavos !== 'number') {
    throw new ErroDeBackup(
      'registroInvalido',
      `lancamentos[${String(indice)}].valorCentavos invalido.`,
    );
  }
  if (typeof categoriaId !== 'string') {
    throw new ErroDeBackup(
      'registroInvalido',
      `lancamentos[${String(indice)}].categoriaId invalido.`,
    );
  }
  if (descricao !== null && typeof descricao !== 'string') {
    throw new ErroDeBackup(
      'registroInvalido',
      `lancamentos[${String(indice)}].descricao invalido.`,
    );
  }
  if (typeof data !== 'string') {
    throw new ErroDeBackup('registroInvalido', `lancamentos[${String(indice)}].data invalido.`);
  }
  if (assinaturaId !== null && typeof assinaturaId !== 'string') {
    throw new ErroDeBackup(
      'registroInvalido',
      `lancamentos[${String(indice)}].assinaturaId invalido.`,
    );
  }

  const candidato: DadosDeLancamento = {
    tipo,
    valorCentavos,
    categoriaId,
    descricao,
    data,
    assinaturaId,
  };
  const problemas = problemasDeLancamento(candidato);
  if (problemas.length > 0) {
    throw new ErroDeBackup(
      'registroInvalido',
      `lancamentos[${String(indice)}]: ${problemas.join('; ')}`,
    );
  }

  return item as unknown as RegistroDeLancamento;
}

function validarLinhaDeAssinatura(item: unknown, indice: number): RegistroDeAssinatura {
  if (!ehObjeto(item)) {
    throw new ErroDeBackup('registroInvalido', `assinaturas[${String(indice)}] nao e um objeto.`);
  }
  const nome = item['nome'];
  const valorCentavos = item['valorCentavos'];
  const periodicidade = item['periodicidade'];
  const proximaCobranca = item['proximaCobranca'];
  const diasDeAviso = item['diasDeAviso'];

  if (typeof nome !== 'string' || nome.trim() === '') {
    throw new ErroDeBackup('registroInvalido', `assinaturas[${String(indice)}].nome invalido.`);
  }
  if (typeof valorCentavos !== 'number' || !Number.isInteger(valorCentavos) || valorCentavos <= 0) {
    throw new ErroDeBackup(
      'registroInvalido',
      `assinaturas[${String(indice)}].valorCentavos invalido.`,
    );
  }
  if (
    typeof periodicidade !== 'string' ||
    !(PERIODICIDADES as readonly string[]).includes(periodicidade)
  ) {
    throw new ErroDeBackup(
      'registroInvalido',
      `assinaturas[${String(indice)}].periodicidade invalida.`,
    );
  }
  if (typeof proximaCobranca !== 'string' || !ehDataDeCalendarioValida(proximaCobranca)) {
    throw new ErroDeBackup(
      'registroInvalido',
      `assinaturas[${String(indice)}].proximaCobranca invalida.`,
    );
  }
  if (typeof diasDeAviso !== 'number' || !Number.isInteger(diasDeAviso) || diasDeAviso < 0) {
    throw new ErroDeBackup(
      'registroInvalido',
      `assinaturas[${String(indice)}].diasDeAviso invalido.`,
    );
  }

  return item as unknown as RegistroDeAssinatura;
}

function validarLinhaDeUsoDeAssinatura(item: unknown, indice: number): RegistroDeUsoDeAssinatura {
  if (!ehObjeto(item)) {
    throw new ErroDeBackup(
      'registroInvalido',
      `usosDeAssinatura[${String(indice)}] nao e um objeto.`,
    );
  }
  const assinaturaId = item['assinaturaId'];
  const data = item['data'];

  if (typeof assinaturaId !== 'string' || assinaturaId === '') {
    throw new ErroDeBackup(
      'registroInvalido',
      `usosDeAssinatura[${String(indice)}].assinaturaId invalido.`,
    );
  }
  if (typeof data !== 'string' || !ehDataDeCalendarioValida(data)) {
    throw new ErroDeBackup(
      'registroInvalido',
      `usosDeAssinatura[${String(indice)}].data invalida.`,
    );
  }

  return item as unknown as RegistroDeUsoDeAssinatura;
}

function validarLinhaDeCofrinho(item: unknown, indice: number): RegistroDeCofrinho {
  if (!ehObjeto(item)) {
    throw new ErroDeBackup('registroInvalido', `cofrinhos[${String(indice)}] nao e um objeto.`);
  }
  const nome = item['nome'];
  const alvoCentavos = item['alvoCentavos'];
  const prazo = item['prazo'];
  const criadoEm = item['criadoEm'];

  if (typeof nome !== 'string' || nome.trim() === '') {
    throw new ErroDeBackup('registroInvalido', `cofrinhos[${String(indice)}].nome invalido.`);
  }
  if (typeof alvoCentavos !== 'number' || !Number.isInteger(alvoCentavos) || alvoCentavos <= 0) {
    throw new ErroDeBackup(
      'registroInvalido',
      `cofrinhos[${String(indice)}].alvoCentavos invalido.`,
    );
  }
  if (prazo !== null && (typeof prazo !== 'string' || !ehDataDeCalendarioValida(prazo))) {
    throw new ErroDeBackup('registroInvalido', `cofrinhos[${String(indice)}].prazo invalido.`);
  }
  if (typeof criadoEm !== 'string' || !ehDataDeCalendarioValida(criadoEm)) {
    throw new ErroDeBackup('registroInvalido', `cofrinhos[${String(indice)}].criadoEm invalido.`);
  }

  return item as unknown as RegistroDeCofrinho;
}

function validarLinhaDeMovimentoDeCofrinho(
  item: unknown,
  indice: number,
): RegistroDeMovimentoDeCofrinho {
  if (!ehObjeto(item)) {
    throw new ErroDeBackup(
      'registroInvalido',
      `movimentosDeCofrinho[${String(indice)}] nao e um objeto.`,
    );
  }
  const cofrinhoId = item['cofrinhoId'];
  const valorCentavos = item['valorCentavos'];
  const data = item['data'];

  if (typeof cofrinhoId !== 'string' || cofrinhoId === '') {
    throw new ErroDeBackup(
      'registroInvalido',
      `movimentosDeCofrinho[${String(indice)}].cofrinhoId invalido.`,
    );
  }
  if (
    typeof valorCentavos !== 'number' ||
    !Number.isInteger(valorCentavos) ||
    valorCentavos === 0
  ) {
    throw new ErroDeBackup(
      'registroInvalido',
      `movimentosDeCofrinho[${String(indice)}].valorCentavos invalido.`,
    );
  }
  if (typeof data !== 'string' || !ehDataDeCalendarioValida(data)) {
    throw new ErroDeBackup(
      'registroInvalido',
      `movimentosDeCofrinho[${String(indice)}].data invalida.`,
    );
  }

  return item as unknown as RegistroDeMovimentoDeCofrinho;
}

/**
 * Categorias padrão para quando um arquivo de backup não menciona a chave
 * "categorias" (pendência 33 do plano: conversão de um backup v1, anterior à
 * existência do pilar financas, na importação). Sem isso, restaurar um
 * backup antigo deixaria o app sem NENHUMA categoria — inviabilizando o
 * "gasto em 3 toques" até o usuário criar uma na mão.
 */
function categoriasIniciaisParaConversao(): RegistroDeCategoria[] {
  const agora = agoraEmIso();
  return NOMES_DE_CATEGORIAS_INICIAIS.map((nome) => ({
    id: gerarIdentificador(),
    createdAt: agora,
    updatedAt: agora,
    deletedAt: null,
    nome,
  }));
}

/** Devolve TODA linha de toda tabela, inclusive soft-deleted, ordenada por `id`. */
async function exportarJson(): Promise<Record<string, readonly unknown[]>> {
  const [categorias, lancamentos, assinaturas, usosDeAssinatura, cofrinhos, movimentosDeCofrinho] =
    await Promise.all([
      tabelaDeCategorias().toArray(),
      tabelaDeLancamentos().toArray(),
      tabelaDeAssinaturas().toArray(),
      tabelaDeUsosDeAssinatura().toArray(),
      tabelaDeCofrinhos().toArray(),
      tabelaDeMovimentosDeCofrinho().toArray(),
    ]);

  return {
    categorias: ordenarPorId(categorias),
    lancamentos: ordenarPorId(lancamentos),
    assinaturas: ordenarPorId(assinaturas),
    usosDeAssinatura: ordenarPorId(usosDeAssinatura),
    cofrinhos: ordenarPorId(cofrinhos),
    movimentosDeCofrinho: ordenarPorId(movimentosDeCofrinho),
  };
}

/**
 * Substituição total (ADR 0006, seção 4.2, regras 3 a 5). Chave de tabela
 * desconhecida lança. Grava o registro como está no arquivo. Quando o
 * arquivo não menciona "categorias" (backup de antes do pilar existir),
 * semeia as categorias padrão em vez de deixar o app sem nenhuma.
 */
async function importarJson(dados: Record<string, readonly unknown[]>): Promise<void> {
  for (const chave of Object.keys(dados)) {
    if (!(NOMES_DE_TABELA_DO_FINANCAS as readonly string[]).includes(chave)) {
      throw new ErroDeBackup(
        'registroInvalido',
        `Tabela desconhecida no modulo financas: "${chave}".`,
      );
    }
  }

  const categoriaAusenteDoArquivo = !('categorias' in dados);

  const linhasDeCategorias = (dados['categorias'] ?? []).map((item, indice) =>
    validarLinhaDeCategoria(item, indice),
  );
  const linhasDeLancamentos = (dados['lancamentos'] ?? []).map((item, indice) =>
    validarLinhaDeLancamento(item, indice),
  );
  const linhasDeAssinaturas = (dados['assinaturas'] ?? []).map((item, indice) =>
    validarLinhaDeAssinatura(item, indice),
  );
  const linhasDeUsosDeAssinatura = (dados['usosDeAssinatura'] ?? []).map((item, indice) =>
    validarLinhaDeUsoDeAssinatura(item, indice),
  );
  const linhasDeCofrinhos = (dados['cofrinhos'] ?? []).map((item, indice) =>
    validarLinhaDeCofrinho(item, indice),
  );
  const linhasDeMovimentosDeCofrinho = (dados['movimentosDeCofrinho'] ?? []).map((item, indice) =>
    validarLinhaDeMovimentoDeCofrinho(item, indice),
  );

  await tabelaDeCategorias().clear();
  await tabelaDeLancamentos().clear();
  await tabelaDeAssinaturas().clear();
  await tabelaDeUsosDeAssinatura().clear();
  await tabelaDeCofrinhos().clear();
  await tabelaDeMovimentosDeCofrinho().clear();

  const categoriasParaGravar = categoriaAusenteDoArquivo
    ? categoriasIniciaisParaConversao()
    : linhasDeCategorias;

  if (categoriasParaGravar.length > 0) await tabelaDeCategorias().bulkPut(categoriasParaGravar);
  if (linhasDeLancamentos.length > 0) await tabelaDeLancamentos().bulkPut(linhasDeLancamentos);
  if (linhasDeAssinaturas.length > 0) await tabelaDeAssinaturas().bulkPut(linhasDeAssinaturas);
  if (linhasDeUsosDeAssinatura.length > 0) {
    await tabelaDeUsosDeAssinatura().bulkPut(linhasDeUsosDeAssinatura);
  }
  if (linhasDeCofrinhos.length > 0) await tabelaDeCofrinhos().bulkPut(linhasDeCofrinhos);
  if (linhasDeMovimentosDeCofrinho.length > 0) {
    await tabelaDeMovimentosDeCofrinho().bulkPut(linhasDeMovimentosDeCofrinho);
  }
}

const COLUNAS_DE_CATEGORIAS: readonly ColunaCsv<RegistroDeCategoria>[] = [
  { titulo: 'id', valor: (r) => r.id },
  { titulo: 'createdAt', valor: (r) => r.createdAt },
  { titulo: 'updatedAt', valor: (r) => r.updatedAt },
  { titulo: 'nome', valor: (r) => r.nome },
];

const COLUNAS_DE_LANCAMENTOS: readonly ColunaCsv<RegistroDeLancamento>[] = [
  { titulo: 'id', valor: (r) => r.id },
  { titulo: 'createdAt', valor: (r) => r.createdAt },
  { titulo: 'updatedAt', valor: (r) => r.updatedAt },
  { titulo: 'tipo', valor: (r) => r.tipo },
  { titulo: 'valorCentavos', valor: (r) => r.valorCentavos },
  { titulo: 'categoriaId', valor: (r) => r.categoriaId },
  { titulo: 'descricao', valor: (r) => r.descricao },
  { titulo: 'data', valor: (r) => r.data },
  { titulo: 'assinaturaId', valor: (r) => r.assinaturaId },
];

/** Só linhas ativas (ADR 0006, seção 3.3), ordenadas por `id`. "Lançamentos no mínimo" (contrato da tarefa). */
async function exportarCsv(): Promise<readonly ArquivoCsv[]> {
  const categorias = ordenarPorId(apenasAtivos(await tabelaDeCategorias().toArray()));
  const lancamentos = ordenarPorId(apenasAtivos(await tabelaDeLancamentos().toArray()));

  return [
    { nome: 'financas-categorias.csv', conteudo: montarCsv(COLUNAS_DE_CATEGORIAS, categorias) },
    { nome: 'financas-lancamentos.csv', conteudo: montarCsv(COLUNAS_DE_LANCAMENTOS, lancamentos) },
  ];
}

/** `clear()` físico nas seis tabelas do financas. Não grava nada. */
async function apagarTudoDoFinancas(): Promise<void> {
  await tabelaDeCategorias().clear();
  await tabelaDeLancamentos().clear();
  await tabelaDeAssinaturas().clear();
  await tabelaDeUsosDeAssinatura().clear();
  await tabelaDeCofrinhos().clear();
  await tabelaDeMovimentosDeCofrinho().clear();
}

export const contratoDeDadosDoFinancas: ContratoDeDadosDeModulo = {
  modulo: 'financas',
  exportarJson,
  importarJson,
  exportarCsv,
  apagarTudo: apagarTudoDoFinancas,
};
