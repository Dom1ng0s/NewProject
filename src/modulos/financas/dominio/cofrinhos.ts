import { diasEntreDatas, ehDataDeCalendarioValida, somarDias } from '@/compartilhado';

/**
 * Regras puras de cofrinhos (docs/ESPECIFICACAO.md §6.2, "Cofrinhos com
 * Projeção"; item 1.5 do plano). Sem React, sem banco, sem relógio — `hoje`
 * sempre chega como parâmetro.
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

/** Lista de problemas (texto de desenvolvedor); vazia = válido. */
export function problemasDeCofrinho(dados: DadosDeCofrinho): string[] {
  const problemas: string[] = [];

  if (dados.nome.trim() === '') {
    problemas.push('Digite um nome para o cofrinho.');
  }
  if (!Number.isInteger(dados.alvoCentavos) || dados.alvoCentavos <= 0) {
    problemas.push('O alvo deve ser um número inteiro de centavos maior que zero.');
  }
  if (dados.prazo !== null && !ehDataDeCalendarioValida(dados.prazo)) {
    problemas.push('O prazo precisa ser um dia real do calendário (ou vazio).');
  }
  if (!ehDataDeCalendarioValida(dados.criadoEm)) {
    problemas.push('A data de criação precisa ser um dia real do calendário.');
  }

  return problemas;
}

/** Lista de problemas (texto de desenvolvedor); vazia = válido. */
export function problemasDeMovimentoDeCofrinho(dados: DadosDeMovimentoDeCofrinho): string[] {
  const problemas: string[] = [];

  if (dados.cofrinhoId.trim() === '') {
    problemas.push('Movimento precisa de um cofrinho.');
  }
  if (!Number.isInteger(dados.valorCentavos) || dados.valorCentavos === 0) {
    problemas.push('O valor deve ser um número inteiro de centavos diferente de zero.');
  }
  if (!ehDataDeCalendarioValida(dados.data)) {
    problemas.push('A data precisa ser um dia real do calendário.');
  }

  return problemas;
}

/** Saldo = soma de todos os movimentos (depósitos positivos, retiradas negativas). */
export function saldoDoCofrinho(
  movimentos: readonly { readonly valorCentavos: number }[],
): number {
  return movimentos.reduce((total, movimento) => total + movimento.valorCentavos, 0);
}

export type ProjecaoDeCofrinho =
  | { readonly tipo: 'concluido' }
  | { readonly tipo: 'semProjecao' }
  | { readonly tipo: 'data'; readonly data: string };

/** Tamanho da janela de observação: 8 semanas (regra 7.4). */
const DIAS_DA_JANELA = 56;

export interface ParametrosDeProjecaoDeCofrinho {
  readonly alvoCentavos: number;
  readonly saldoAtualCentavos: number;
  /** `AAAA-MM-DD` local de quando o cofrinho foi criado. */
  readonly criadoEm: string;
  /** `AAAA-MM-DD` local, dia de referência do cálculo. */
  readonly hoje: string;
  /** Todos os movimentos ativos do cofrinho (a função filtra a janela sozinha). */
  readonly movimentos: readonly { readonly valorCentavos: number; readonly data: string }[];
}

/**
 * Regra 7.4: média de depósitos líquidos por semana nas últimas 8 semanas (ou
 * desde a criação, se menor); data projetada = hoje + (valor faltante / média
 * semanal) semanas. Alvo já atingido: "concluido" (nunca uma data). Sem
 * histórico suficiente (cofrinho criado hoje) ou média zero/negativa: "sem
 * projeção".
 */
export function projetarConclusaoDoCofrinho(
  parametros: ParametrosDeProjecaoDeCofrinho,
): ProjecaoDeCofrinho {
  const { alvoCentavos, saldoAtualCentavos, criadoEm, hoje, movimentos } = parametros;

  if (saldoAtualCentavos >= alvoCentavos) return { tipo: 'concluido' };

  const diasDesdeACriacao = diasEntreDatas(criadoEm, hoje);
  const diasDaJanela = Math.min(DIAS_DA_JANELA, diasDesdeACriacao);
  if (diasDaJanela <= 0) return { tipo: 'semProjecao' };

  const inicioDaJanela = somarDias(hoje, -diasDaJanela);
  const somaLiquidaNaJanela = movimentos
    .filter((movimento) => movimento.data >= inicioDaJanela && movimento.data <= hoje)
    .reduce((total, movimento) => total + movimento.valorCentavos, 0);

  const semanasNaJanela = diasDaJanela / 7;
  const mediaSemanal = somaLiquidaNaJanela / semanasNaJanela;
  if (mediaSemanal <= 0) return { tipo: 'semProjecao' };

  const faltanteCentavos = alvoCentavos - saldoAtualCentavos;
  const semanasNecessarias = faltanteCentavos / mediaSemanal;
  const diasNecessarios = Math.round(semanasNecessarias * 7);

  return { tipo: 'data', data: somarDias(hoje, diasNecessarios) };
}
