import { agoraEmIso } from '@/compartilhado';
import { TABELAS, VERSAO_DO_SCHEMA, emTransacao, emTransacaoDeLeitura } from '@/persistencia';
import type { RegistroBase } from '@/persistencia';
import { montarBackup, resumirBackup } from '../dominio/backup';
import type {
  ArquivoDeBackup,
  DadosDeModulo,
  RegistroDoBackup,
  ResumoDoBackup,
} from '../dominio/backup';
import type { ArquivoCsv, ContratoDeDadosDeModulo, IdDeModulo } from '../tipos';

/**
 * Prova de compatibilidade (ADR 0006, seção 2.3): `RegistroDoBackup` duplica
 * os quatro campos de `RegistroBase` porque `dominio/` não pode importar
 * `@/persistencia`. Esta constante falha a compilação se `RegistroBase`
 * deixar de satisfazer `RegistroDoBackup`.
 */
export const PROVA_DE_COMPATIBILIDADE: RegistroBase extends RegistroDoBackup ? true : never = true;

/**
 * A tela `Dados.tsx` chama `lerBackup(texto, VERSAO_DO_SCHEMA)` (ADR 0006,
 * seção 7.3) mas não pode importar `@/persistencia` (matriz do ADR 0002,
 * seção 4). Reexportado aqui — este arquivo já importa `@/persistencia`
 * legitimamente — para que `index.ts` do módulo não precise abrir uma
 * exceção na fronteira de import.
 */
export { VERSAO_DO_SCHEMA } from '@/persistencia';

export interface ResultadoDaImportacao {
  readonly resumo: ResumoDoBackup;
  readonly registrosImportados: number;
}

/** Lê TODAS as tabelas numa transação de leitura e monta o envelope. */
export function exportarBackup(
  contratos: readonly ContratoDeDadosDeModulo[],
): Promise<ArquivoDeBackup> {
  return emTransacaoDeLeitura(TABELAS, async () => {
    const modulos: Partial<Record<IdDeModulo, DadosDeModulo>> = {};
    for (const contrato of contratos) {
      modulos[contrato.modulo] = await contrato.exportarJson();
    }
    return montarBackup({ geradoEm: agoraEmIso(), versaoDoSchema: VERSAO_DO_SCHEMA, modulos });
  });
}

export interface CsvsDeModulo {
  readonly modulo: IdDeModulo;
  readonly arquivos: readonly ArquivoCsv[]; // vazio = modulo sem dado
}

/**
 * Uma única transação de leitura para os CSVs de todos os módulos, pelo
 * mesmo motivo de `exportarBackup`: evitar capturar um estado inconsistente
 * entre módulos.
 */
export function exportarCsvPorModulo(
  contratos: readonly ContratoDeDadosDeModulo[],
): Promise<readonly CsvsDeModulo[]> {
  return emTransacaoDeLeitura(TABELAS, async () => {
    const resultado: CsvsDeModulo[] = [];
    for (const contrato of contratos) {
      resultado.push({ modulo: contrato.modulo, arquivos: await contrato.exportarCsv() });
    }
    return resultado;
  });
}

/**
 * SUBSTITUI o banco inteiro pelo conteúdo do arquivo, numa única transação
 * sobre TABELAS. Chama `importarJson` de TODOS os contratos registrados,
 * inclusive dos módulos ausentes do arquivo (com `{}`), para que importar
 * seja substituição total e nunca mesclagem. Qualquer exceção desfaz tudo.
 */
export function importarBackup(
  contratos: readonly ContratoDeDadosDeModulo[],
  arquivo: ArquivoDeBackup,
): Promise<ResultadoDaImportacao> {
  return emTransacao(TABELAS, async () => {
    for (const contrato of contratos) {
      const dadosDoModulo = (arquivo.modulos[contrato.modulo] ?? {}) as Record<
        string,
        readonly unknown[]
      >;
      await contrato.importarJson(dadosDoModulo);
    }

    const resumo = resumirBackup(arquivo);
    return { resumo, registrosImportados: resumo.registros };
  });
}

/**
 * Exclusão FÍSICA de todos os dados do usuário, numa única transação sobre
 * TABELAS: chama `apagarTudo` de cada contrato. Não registra ação no
 * histórico e não grava configuração nenhuma (ADR 0006, seção 6).
 */
export function apagarTudo(contratos: readonly ContratoDeDadosDeModulo[]): Promise<void> {
  return emTransacao(TABELAS, async () => {
    for (const contrato of contratos) {
      await contrato.apagarTudo();
    }
  });
}
