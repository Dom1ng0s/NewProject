import type { IdDeModulo } from '../../tipos';

/**
 * Envelope do arquivo de backup (ADR 0006, seção 1). Puro: sem relógio, sem
 * banco, sem React. Duas versões independentes porque mudam por motivos
 * diferentes: `versaoDoFormato` é a forma do envelope (metadados + módulos);
 * `versaoDoSchema` é a versão do schema do banco (`VERSAO_DO_SCHEMA`, ADR
 * 0005), que descreve a forma dos registros de dentro.
 */
export const FORMATO_DO_BACKUP = 'app-rotina-backup';
export const VERSAO_DO_FORMATO_DE_BACKUP = 1;

/**
 * Só identificação técnica e instante. NUNCA modelo do aparelho, user agent,
 * fuso, nome de usuário ou qualquer dado de identificação (princípios 1 e 5).
 */
export interface MetadadosDoBackup {
  readonly formato: typeof FORMATO_DO_BACKUP;
  readonly versaoDoFormato: number;
  readonly versaoDoSchema: number;
  /** Instante ISO em UTC (`agoraEmIso()`). */
  readonly geradoEm: string;
}

/** Uma chave por tabela do módulo, com TODOS os registros (inclusive soft-deleted). */
export type DadosDeModulo = Readonly<Record<string, readonly unknown[]>>;

export interface ArquivoDeBackup {
  readonly metadados: MetadadosDoBackup;
  /** Uma chave por módulo. A exportação escreve as quatro, mesmo vazias. */
  readonly modulos: Readonly<Partial<Record<IdDeModulo, DadosDeModulo>>>;
}

export interface ResumoDeTabela {
  readonly tabela: string;
  readonly registros: number;
}

export interface ResumoDeModulo {
  readonly modulo: IdDeModulo;
  readonly tabelas: readonly ResumoDeTabela[];
  readonly registros: number;
}

export interface ResumoDoBackup {
  readonly geradoEm: string;
  readonly versaoDoSchema: number;
  readonly registros: number;
  /** Só módulos com pelo menos 1 registro. */
  readonly modulos: readonly ResumoDeModulo[];
}

/** Ordem fixa e determinística de exibição do resumo. */
const ORDEM_DOS_MODULOS: readonly IdDeModulo[] = ['nucleo', 'treino', 'estudos', 'financas'];

/** Contagens, nada de conteúdo. Serve para a confirmação da importação. */
export function resumirBackup(arquivo: ArquivoDeBackup): ResumoDoBackup {
  const modulos: ResumoDeModulo[] = [];
  let registros = 0;

  for (const idDeModulo of ORDEM_DOS_MODULOS) {
    const dados = arquivo.modulos[idDeModulo];
    if (!dados) continue;

    const tabelas: ResumoDeTabela[] = [];
    let registrosDoModulo = 0;
    for (const nomeDaTabela of Object.keys(dados).sort()) {
      const quantidade = dados[nomeDaTabela]?.length ?? 0;
      tabelas.push({ tabela: nomeDaTabela, registros: quantidade });
      registrosDoModulo += quantidade;
    }

    if (registrosDoModulo === 0) continue;

    modulos.push({ modulo: idDeModulo, tabelas, registros: registrosDoModulo });
    registros += registrosDoModulo;
  }

  return {
    geradoEm: arquivo.metadados.geradoEm,
    versaoDoSchema: arquivo.metadados.versaoDoSchema,
    registros,
    modulos,
  };
}
