import type { IdDeModulo } from '../tipos';

/**
 * Base do XP (item 0.12, D5): o histórico de ações é a única fonte, e o XP
 * (Fase 5) é sempre uma função pura sobre ele — nunca um contador gravado.
 * Sem React, sem banco, sem relógio.
 *
 * `TipoDeAcao` começa com um único membro real; cada fase acrescenta o seu.
 * O `switch-exhaustiveness-check` do ESLint faz o cálculo de XP falhar a
 * compilação quando um tipo novo entra sem peso definido.
 */
export type TipoDeAcao = 'nucleo.configuracoesSalvas' | 'financas.lancamentoRegistrado';
// Fases seguintes acrescentam 'treino.serieRegistrada', 'estudos.sessaoDeFocoConcluida', ...

export interface AcaoDoHistorico {
  tipo: TipoDeAcao;
  modulo: IdDeModulo;
  /** Instante ISO em UTC de quando a ação aconteceu (pode ser retroativo). */
  ocorridaEm: string;
  /** `AAAA-MM-DD` local, derivado de `ocorridaEm`. */
  dia: string;
  /** Id do registro que originou a ação (série, sessão, lançamento). */
  referenciaId: string | null;
  /** Uma única grandeza inteira para o XP: minutos focados, séries, cards revisados. */
  quantidade: number | null;
}

/** Entrada de quem registra: `dia` é derivado, `ocorridaEm` cai para agora. */
export interface EntradaDeAcao {
  tipo: TipoDeAcao;
  modulo: IdDeModulo;
  referenciaId: string | null;
  quantidade: number | null;
  ocorridaEm?: string;
}

/**
 * Módulo dono do tipo, pelo prefixo antes do ponto (ex.:
 * `'nucleo.configuracoesSalvas'` → `'nucleo'`). O cast é seguro porque todo
 * membro de `TipoDeAcao` é, por convenção, `${IdDeModulo}.${string}`; o
 * compilador não infere essa forma a partir de `string.split`.
 */
export function moduloDoTipo(tipo: TipoDeAcao): IdDeModulo {
  const [modulo] = tipo.split('.');
  return modulo as IdDeModulo;
}
