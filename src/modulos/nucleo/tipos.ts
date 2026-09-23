import type { ComponentType } from 'react';

export type IdDeModulo = 'nucleo' | 'treino' | 'estudos' | 'financas';

/** O cartão que o módulo mostra na tela Hoje (ADR 0002, seção 3; ADR 0009, seção 3). */
export interface CartaoDeHoje {
  readonly modulo: IdDeModulo;
  /** Posição na Hoje; menor aparece antes. Única entre os módulos. */
  readonly ordem: number;
  /** Texto do `<h2>` que a Hoje desenha acima do conteúdo. Vem do i18n do módulo. */
  readonly titulo: string;
  /** Só o CONTEÚDO do cartão: sem `<section>`, sem `<h2>`, sem `<main>`. Lê seus próprios dados por hook. */
  readonly Componente: ComponentType; // lê seus próprios dados por hook
}

/**
 * Atalho de registro frequente na Hoje (princípio 6, D4). Um toque leva DIRETO
 * à tela de registro daquele tipo, já pronta para a primeira interação útil.
 */
export interface AtalhoDeRegistro {
  readonly modulo: IdDeModulo;
  /** Posição na área "Registrar agora"; menor aparece antes. */
  readonly ordem: number;
  /** Texto visível E nome acessível (ex.: 'Gasto'). Tem de fazer sentido sob o título "Registrar agora". */
  readonly rotulo: string;
  /** Rota interna do app (ex.: '/financas/novo-gasto'). Nunca URL externa. */
  readonly destino: string;
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
