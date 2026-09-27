import { ehDataDeCalendarioValida } from '@/compartilhado';

/**
 * Regras puras de lançamentos (gasto ou entrada; docs/ESPECIFICACAO.md §6.2).
 * Sem React, sem banco, sem relógio: `data` chega pronta (padrão hoje, ou a
 * data retroativa escolhida pelo usuário).
 */
export type TipoDeLancamento = 'gasto' | 'entrada';

export interface DadosDeLancamento {
  readonly tipo: TipoDeLancamento;
  /** Inteiro em centavos, sempre positivo — o sinal vem de `tipo`, nunca do valor. */
  readonly valorCentavos: number;
  readonly categoriaId: string;
  readonly descricao: string | null;
  /** `AAAA-MM-DD` local (ADR 0005, seção 2, regra 4). */
  readonly data: string;
  /** `null` quando o lançamento não veio de uma cobrança de assinatura (item 1.1; geração automática chega no item 1.3). */
  readonly assinaturaId: string | null;
}

/** Lista de problemas (texto de desenvolvedor); vazia = válido. */
export function problemasDeLancamento(dados: DadosDeLancamento): string[] {
  const problemas: string[] = [];

  if (dados.tipo !== 'gasto' && dados.tipo !== 'entrada') {
    problemas.push('tipo deve ser "gasto" ou "entrada".');
  }
  if (!Number.isInteger(dados.valorCentavos) || dados.valorCentavos <= 0) {
    problemas.push('O valor deve ser um número inteiro de centavos maior que zero.');
  }
  if (dados.categoriaId.trim() === '') {
    problemas.push('Escolha uma categoria.');
  }
  if (!ehDataDeCalendarioValida(dados.data)) {
    problemas.push('A data precisa ser um dia real do calendário, no formato AAAA-MM-DD.');
  }

  return problemas;
}

interface LancamentoParaSoma {
  readonly tipo: TipoDeLancamento;
  readonly valorCentavos: number;
}

/** Soma dos valores dos lançamentos do tipo "gasto" (entradas não entram, regra 7.3). */
export function somarGastosEmCentavos(lancamentos: readonly LancamentoParaSoma[]): number {
  return lancamentos.reduce(
    (total, lancamento) => (lancamento.tipo === 'gasto' ? total + lancamento.valorCentavos : total),
    0,
  );
}
