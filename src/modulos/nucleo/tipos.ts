import type { ComponentType } from 'react';

export type IdDeModulo = 'nucleo' | 'treino' | 'estudos' | 'financas';

/** O cartão que o módulo mostra na tela Hoje. */
export interface CartaoDeHoje {
  readonly modulo: IdDeModulo;
  readonly ordem: number; // posição na Hoje; menor aparece antes
  readonly Componente: ComponentType; // lê seus próprios dados por hook
}

export interface ArquivoCsv {
  readonly nome: string; // ex.: 'treino-series.csv'
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
