/**
 * Tipos de assinatura (docs/ESPECIFICACAO.md §6.2, "Controle de Assinaturas").
 * Só o schema nesta entrega (item 1.1 do plano) — cadastro, "usei hoje" e
 * cobrança automática chegam no item 1.3. Sem React, sem banco.
 */
export type Periodicidade = 'mensal' | 'anual';

export interface DadosDeAssinatura {
  readonly nome: string;
  readonly valorCentavos: number;
  readonly periodicidade: Periodicidade;
  /** `AAAA-MM-DD` local da próxima cobrança. */
  readonly proximaCobranca: string;
  /** Dias de antecedência do aviso de renovação (item 1.4). */
  readonly diasDeAviso: number;
}

export interface DadosDeUsoDeAssinatura {
  readonly assinaturaId: string;
  /** `AAAA-MM-DD` local do dia em que a assinatura foi usada. */
  readonly data: string;
}
