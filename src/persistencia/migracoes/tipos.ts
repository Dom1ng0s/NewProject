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
  /**
   * Semente de dados só para um banco CRIADO DO ZERO (`db.on('populate')` do
   * Dexie). O Dexie não roda `upgrade` de nenhuma versão quando o banco não
   * existe ainda — ele cria o schema final direto e dispara só o evento
   * `populate` uma vez (ver `criarBanco`, `src/persistencia/db.ts`). Por
   * isso uma migração que precisa semear dado tanto para quem já tinha o
   * banco (via `upgrade`) quanto para instalação nova (via `popular`)
   * declara os dois, normalmente chamando a mesma função pura.
   */
  readonly popular?: (transacao: Transaction) => Promise<void>;
}
