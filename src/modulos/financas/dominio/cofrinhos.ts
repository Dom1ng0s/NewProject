/**
 * Tipos de cofrinho (docs/ESPECIFICACAO.md §6.2, "Cofrinhos com Projeção"). Só
 * o schema nesta entrega (item 1.1 do plano) — tela, depósitos/retiradas e a
 * regra 7.4 (projeção) chegam no item 1.5. Sem React, sem banco.
 */
export interface DadosDeCofrinho {
  readonly nome: string;
  readonly alvoCentavos: number;
  /** `AAAA-MM-DD` local; `null` = sem prazo definido. */
  readonly prazo: string | null;
  /** `AAAA-MM-DD` local de quando a meta começou a valer (pode ser retroativo). */
  readonly criadoEm: string;
}

export interface DadosDeMovimentoDeCofrinho {
  readonly cofrinhoId: string;
  /** Inteiro em centavos, COM sinal: positivo = depósito, negativo = retirada. */
  readonly valorCentavos: number;
  /** `AAAA-MM-DD` local. */
  readonly data: string;
}
