/**
 * Regra 7.3 (docs/ESPECIFICACAO.md): disponível para hoje.
 *
 * ```
 * restanteMes    = orcamentoMes − gastosDoMesAteOntem − assinaturasAVencerNoMes
 * diasRestantes  = dias do mês de hoje até o último dia, incluindo hoje
 * cotaDiaria     = restanteMes / diasRestantes
 * disponivelHoje = cotaDiaria − gastosDeHoje
 * ```
 *
 * Função pura sobre totais já somados por quem chama (o repositório soma os
 * lançamentos do mês) — não lê banco nem relógio. `orcamentoMensalEmCentavos`
 * é `null` quando o usuário ainda não definiu orçamento (D11): a função
 * devolve `null` sem calcular nada, e quem chama decide mostrar "defina seu
 * orçamento" (a Hoje, ADR 0009 seção 3.3).
 */
export interface AssinaturaParaCalculo {
  readonly valorCentavos: number;
  /** `AAAA-MM-DD` local da próxima cobrança ainda não gerada como lançamento. */
  readonly proximaCobranca: string;
}

export interface ParametrosDeDisponivelHoje {
  readonly orcamentoMensalEmCentavos: number | null;
  /** `AAAA-MM-DD` local, dia de referência do cálculo ("hoje"). */
  readonly hoje: string;
  readonly gastosDoMesAteOntemEmCentavos: number;
  readonly gastosDeHojeEmCentavos: number;
  readonly assinaturas: readonly AssinaturaParaCalculo[];
}

function partesDeData(data: string): {
  readonly ano: number;
  readonly mes: number;
  readonly dia: number;
} {
  const [anoTexto, mesTexto, diaTexto] = data.split('-');
  return { ano: Number(anoTexto), mes: Number(mesTexto), dia: Number(diaTexto) };
}

/** Último dia do mês (1-31), com `mesIndiceZero` de 0 (janeiro) a 11 (dezembro). */
function ultimoDiaDoMes(ano: number, mesIndiceZero: number): number {
  return new Date(ano, mesIndiceZero + 1, 0).getDate();
}

/**
 * Soma das cobranças de assinaturas que ainda vão cair do dia de hoje
 * (inclusive) até o fim do mês corrente, para uma assinatura que ainda não
 * gerou o lançamento de gasto correspondente (pendência 2 do plano — evita
 * descontar duas vezes). A geração automática do lançamento na data de
 * cobrança chega no item 1.3; aqui só o total é calculado a partir da lista
 * recebida.
 */
export function assinaturasAVencerNoMes(
  assinaturas: readonly AssinaturaParaCalculo[],
  hoje: string,
): number {
  const referencia = partesDeData(hoje);

  return assinaturas.reduce((total, assinatura) => {
    const cobranca = partesDeData(assinatura.proximaCobranca);
    const noMesCorrente = cobranca.ano === referencia.ano && cobranca.mes === referencia.mes;
    const aindaNaoPassou = assinatura.proximaCobranca >= hoje;
    return noMesCorrente && aindaNaoPassou ? total + assinatura.valorCentavos : total;
  }, 0);
}

/**
 * Regra 7.3. Devolve `null` quando não há orçamento definido. Pode devolver
 * negativo (o valor excedido); arredondamento sempre em centavos inteiros
 * (`Math.round` na cota diária).
 */
export function disponivelHoje(parametros: ParametrosDeDisponivelHoje): number | null {
  const {
    orcamentoMensalEmCentavos,
    hoje,
    gastosDoMesAteOntemEmCentavos,
    gastosDeHojeEmCentavos,
    assinaturas,
  } = parametros;

  if (orcamentoMensalEmCentavos === null) return null;

  const { ano, mes, dia } = partesDeData(hoje);
  const totalDeAssinaturas = assinaturasAVencerNoMes(assinaturas, hoje);

  const restanteMes =
    orcamentoMensalEmCentavos - gastosDoMesAteOntemEmCentavos - totalDeAssinaturas;
  const diasRestantes = ultimoDiaDoMes(ano, mes - 1) - dia + 1;
  const cotaDiaria = Math.round(restanteMes / diasRestantes);

  return cotaDiaria - gastosDeHojeEmCentavos;
}
