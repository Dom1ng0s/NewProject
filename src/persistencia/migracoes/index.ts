import { v1Inicial } from './v1-inicial';
import { v2Financas } from './v2-financas';
import type { Migracao } from './tipos';

/** Ordem crescente e imutável. Migração publicada NUNCA é editada. */
export const MIGRACOES: readonly Migracao[] = [v1Inicial, v2Financas];

export const VERSAO_DO_SCHEMA = MIGRACOES.length; // === última versão, por construção
export type { Migracao };
