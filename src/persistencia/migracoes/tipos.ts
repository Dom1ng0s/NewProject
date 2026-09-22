import type { Transaction } from 'dexie';

export interface Migracao {
  /** Versão do schema. Sequencial, começando em 1, sem buracos. */
  readonly versao: number;
  /**
   * Só o que MUDOU nesta versão (o Dexie acumula as versões anteriores):
   * tabela nova, índice novo/removido, ou `null` para apagar a tabela.
   */
  readonly stores: Readonly<Record<string, string | null>>;
  /** Só quando dado existente precisa ser transformado. */
  readonly upgrade?: (transacao: Transaction) => Promise<void>;
}
