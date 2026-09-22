import { v1Inicial } from './v1-inicial';
import type { Migracao } from './tipos';

/** Ordem crescente e imutável. Migração publicada NUNCA é editada. */
export const MIGRACOES: readonly Migracao[] = [v1Inicial];

export const VERSAO_DO_SCHEMA = MIGRACOES.length; // === última versão, por construção
export type { Migracao };
