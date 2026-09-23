import { dataDeCalendarioDe } from '@/compartilhado';
import type { IdDeModulo } from '../../tipos';
import { FORMATO_DO_BACKUP, VERSAO_DO_FORMATO_DE_BACKUP } from './formato';
import type { ArquivoDeBackup, DadosDeModulo } from './formato';
import { ErroDeBackup, ehErroDeBackup } from './erros';
import type { CodigoDeErroDeBackup } from './erros';

/** Monta o envelope. `geradoEm` e `versaoDoSchema` vêm de fora: função pura. */
export function montarBackup(entrada: {
  readonly geradoEm: string;
  readonly versaoDoSchema: number;
  readonly modulos: Readonly<Partial<Record<IdDeModulo, DadosDeModulo>>>;
}): ArquivoDeBackup {
  return {
    metadados: {
      formato: FORMATO_DO_BACKUP,
      versaoDoFormato: VERSAO_DO_FORMATO_DE_BACKUP,
      versaoDoSchema: entrada.versaoDoSchema,
      geradoEm: entrada.geradoEm,
    },
    modulos: entrada.modulos,
  };
}

/**
 * `JSON.stringify` indentado + quebra de linha final, UTF-8 sem BOM (ADR
 * 0006, seção 1.3). Indentado de propósito: é um arquivo que o usuário pode
 * abrir e ler.
 */
export function serializarBackup(arquivo: ArquivoDeBackup): string {
  return `${JSON.stringify(arquivo, null, 2)}\n`;
}

export type LeituraDeBackup =
  | { readonly ok: true; readonly arquivo: ArquivoDeBackup }
  | { readonly ok: false; readonly erro: ErroDeBackup };

/** Forma mínima exigida de todo registro, espelho de `RegistroBase`. */
export interface RegistroDoBackup {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

const IDS_DE_MODULO: readonly IdDeModulo[] = ['nucleo', 'treino', 'estudos', 'financas'];

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function ehIdDeModulo(valor: string): valor is IdDeModulo {
  return (IDS_DE_MODULO as readonly string[]).includes(valor);
}

/**
 * Mesmo critério de "instante ISO com componente de hora" usado em
 * `dataDeCalendarioDe` (`@/compartilhado`): reaproveita a função pública
 * (que lança em instante inválido) só para o teste booleano, em vez de
 * duplicar o regex/critério aqui.
 */
function ehInstanteIso(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;
  try {
    dataDeCalendarioDe(valor);
    return true;
  } catch {
    return false;
  }
}

function ehRegistroDoBackup(item: unknown): item is RegistroDoBackup {
  if (!ehObjeto(item)) return false;

  const id = item['id'];
  const createdAt = item['createdAt'];
  const updatedAt = item['updatedAt'];
  const deletedAt = item['deletedAt'];

  if (typeof id !== 'string' || id.length === 0) return false;
  if (!ehInstanteIso(createdAt)) return false;
  if (!ehInstanteIso(updatedAt)) return false;
  if (deletedAt !== null && !ehInstanteIso(deletedAt)) return false;

  return true;
}

/**
 * Valida a forma de `RegistroBase` de cada item da tabela e a ausência de
 * `id` duplicado (senão o `bulkPut` engoliria um registro em silêncio). NÃO
 * valida campo de negócio — isso é de cada módulo (ADR 0006, seção 5.2).
 * Lança `ErroDeBackup` na primeira reprovação.
 */
export function validarRegistrosDaTabela(
  modulo: IdDeModulo,
  tabela: string,
  valor: unknown,
): readonly RegistroDoBackup[] {
  if (!Array.isArray(valor)) {
    throw new ErroDeBackup(
      'estruturaInvalida',
      `modulos.${modulo}.${tabela} deveria ser uma lista de registros.`,
    );
  }

  const idsVistos = new Set<string>();
  const registros: RegistroDoBackup[] = [];

  valor.forEach((item: unknown, indice: number) => {
    if (!ehRegistroDoBackup(item)) {
      throw new ErroDeBackup(
        'registroInvalido',
        `modulos.${modulo}.${tabela}[${String(indice)}] nao tem a forma de um registro valido.`,
      );
    }
    if (idsVistos.has(item.id)) {
      throw new ErroDeBackup(
        'registroInvalido',
        `modulos.${modulo}.${tabela}[${String(indice)}] repete o id "${item.id}".`,
      );
    }
    idsVistos.add(item.id);
    registros.push(item);
  });

  return registros;
}

function falha(codigo: CodigoDeErroDeBackup, detalhe: string): LeituraDeBackup {
  return { ok: false, erro: new ErroDeBackup(codigo, detalhe) };
}

/**
 * Parse + validação do envelope. NÃO toca no banco e NÃO valida campo de
 * negócio (isso é de cada módulo, seção 5.2). `versaoDoSchemaAtual` entra
 * por parâmetro porque `dominio/` não pode importar a camada de persistência.
 */
export function lerBackup(texto: string, versaoDoSchemaAtual: number): LeituraDeBackup {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return falha('jsonInvalido', 'O conteudo do arquivo nao e um JSON valido.');
  }

  if (!ehObjeto(bruto)) {
    return falha('naoEhBackup', 'A raiz do arquivo nao e um objeto.');
  }

  const metadadosBruto = bruto['metadados'];
  const modulosBruto = bruto['modulos'];
  if (!ehObjeto(metadadosBruto) || !ehObjeto(modulosBruto)) {
    return falha('naoEhBackup', 'O arquivo nao tem os campos "metadados" e "modulos".');
  }

  if (metadadosBruto['formato'] !== FORMATO_DO_BACKUP) {
    return falha('naoEhBackup', 'metadados.formato nao identifica um backup deste app.');
  }

  const versaoDoFormato = metadadosBruto['versaoDoFormato'];
  if (typeof versaoDoFormato !== 'number' || !Number.isInteger(versaoDoFormato)) {
    return falha('naoEhBackup', 'metadados.versaoDoFormato ausente ou invalido.');
  }
  if (versaoDoFormato > VERSAO_DO_FORMATO_DE_BACKUP) {
    return falha(
      'formatoMaisNovo',
      `versaoDoFormato ${String(versaoDoFormato)} e mais novo que o suportado (${String(VERSAO_DO_FORMATO_DE_BACKUP)}).`,
    );
  }
  if (versaoDoFormato < VERSAO_DO_FORMATO_DE_BACKUP) {
    return falha(
      'formatoMaisAntigo',
      `versaoDoFormato ${String(versaoDoFormato)} e mais antigo que o suportado (${String(VERSAO_DO_FORMATO_DE_BACKUP)}).`,
    );
  }

  const versaoDoSchema = metadadosBruto['versaoDoSchema'];
  if (typeof versaoDoSchema !== 'number' || !Number.isInteger(versaoDoSchema)) {
    return falha('naoEhBackup', 'metadados.versaoDoSchema ausente ou invalido.');
  }
  if (versaoDoSchema > versaoDoSchemaAtual) {
    return falha(
      'schemaMaisNovo',
      `versaoDoSchema ${String(versaoDoSchema)} e mais novo que o atual (${String(versaoDoSchemaAtual)}).`,
    );
  }
  if (versaoDoSchema < versaoDoSchemaAtual) {
    return falha(
      'schemaMaisAntigo',
      `versaoDoSchema ${String(versaoDoSchema)} e mais antigo que o atual (${String(versaoDoSchemaAtual)}).`,
    );
  }

  const geradoEm = metadadosBruto['geradoEm'];
  if (!ehInstanteIso(geradoEm)) {
    return falha('naoEhBackup', 'metadados.geradoEm nao e um instante ISO valido.');
  }

  const modulos: Partial<Record<IdDeModulo, DadosDeModulo>> = {};

  for (const chaveDeModulo of Object.keys(modulosBruto)) {
    if (!ehIdDeModulo(chaveDeModulo)) {
      return falha('moduloDesconhecido', `Modulo desconhecido no arquivo: "${chaveDeModulo}".`);
    }

    const valorDoModulo = modulosBruto[chaveDeModulo];
    if (!ehObjeto(valorDoModulo)) {
      return falha('estruturaInvalida', `modulos.${chaveDeModulo} deveria ser um objeto.`);
    }

    const dadosDoModulo: Record<string, readonly RegistroDoBackup[]> = {};
    for (const nomeDaTabela of Object.keys(valorDoModulo)) {
      const valorDaTabela = valorDoModulo[nomeDaTabela];
      try {
        dadosDoModulo[nomeDaTabela] = validarRegistrosDaTabela(
          chaveDeModulo,
          nomeDaTabela,
          valorDaTabela,
        );
      } catch (erro) {
        if (ehErroDeBackup(erro)) return { ok: false, erro };
        throw erro;
      }
    }

    modulos[chaveDeModulo] = dadosDoModulo;
  }

  return { ok: true, arquivo: montarBackup({ geradoEm, versaoDoSchema, modulos }) };
}
