import { adicionarMeses, diasEntreDatas, ehDataDeCalendarioValida } from '@/compartilhado';

/**
 * Regras puras de assinaturas (docs/ESPECIFICACAO.md §6.2, "Controle de
 * Assinaturas"; item 1.3 do plano). Sem React, sem banco, sem relógio — `hoje`
 * sempre chega como parâmetro.
 */
export type Periodicidade = 'mensal' | 'anual';

export interface DadosDeAssinatura {
  readonly nome: string;
  readonly valorCentavos: number;
  readonly periodicidade: Periodicidade;
  /** `AAAA-MM-DD` local da próxima cobrança ainda não gerada como lançamento. */
  readonly proximaCobranca: string;
  /** Dias de antecedência do aviso de renovação (item 1.4). */
  readonly diasDeAviso: number;
  /** Categoria do gasto gerado pela cobrança automática. */
  readonly categoriaId: string;
  /**
   * Dia do mês (1-31) que a cobrança "deveria" cair. Preservado mesmo quando
   * um mês mais curto obriga a próxima cobrança a cair antes (ex.: assinatura
   * do dia 31 cobrada em fevereiro cai no dia 28, mas a âncora continua 31
   * para o mês seguinte) — ver `calcularCobrancasVencidas`. Derivado do dia
   * de `proximaCobranca` sempre que o usuário escolhe uma nova data (criação
   * ou edição); a cobrança automática nunca o altera.
   */
  readonly diaDeCobranca: number;
}

export interface DadosDeUsoDeAssinatura {
  readonly assinaturaId: string;
  /** `AAAA-MM-DD` local do dia em que a assinatura foi usada. */
  readonly data: string;
}

/** Dia do mês (1-31) de uma data `AAAA-MM-DD`; usado para derivar `diaDeCobranca`. */
export function diaDoMesDe(data: string): number {
  return Number(data.slice(8, 10));
}

/** Lista de problemas (texto de desenvolvedor); vazia = válido. */
export function problemasDeAssinatura(dados: DadosDeAssinatura): string[] {
  const problemas: string[] = [];

  if (dados.nome.trim() === '') {
    problemas.push('Digite um nome para a assinatura.');
  }
  if (!Number.isInteger(dados.valorCentavos) || dados.valorCentavos <= 0) {
    problemas.push('O valor deve ser um número inteiro de centavos maior que zero.');
  }
  if (dados.periodicidade !== 'mensal' && dados.periodicidade !== 'anual') {
    problemas.push('periodicidade deve ser "mensal" ou "anual".');
  }
  if (!ehDataDeCalendarioValida(dados.proximaCobranca)) {
    problemas.push('A próxima cobrança precisa ser um dia real do calendário.');
  }
  if (!Number.isInteger(dados.diasDeAviso) || dados.diasDeAviso < 0) {
    problemas.push('Os dias de aviso devem ser um número inteiro maior ou igual a zero.');
  }
  if (dados.categoriaId.trim() === '') {
    problemas.push('Escolha uma categoria.');
  }
  if (!Number.isInteger(dados.diaDeCobranca) || dados.diaDeCobranca < 1 || dados.diaDeCobranca > 31) {
    problemas.push('O dia de cobrança deve ser um número inteiro entre 1 e 31.');
  }

  return problemas;
}

/** Valor mensal equivalente: o próprio valor se mensal, ou o valor anual dividido por 12. Arredondado em centavos inteiros. */
export function valorMensalEquivalente(assinatura: {
  readonly valorCentavos: number;
  readonly periodicidade: Periodicidade;
}): number {
  return assinatura.periodicidade === 'mensal'
    ? assinatura.valorCentavos
    : Math.round(assinatura.valorCentavos / 12);
}

/** Soma de `valorMensalEquivalente` (anual/12 no mensal), regra do item 1.3. */
export function totalMensalDeAssinaturas(
  assinaturas: readonly { readonly valorCentavos: number; readonly periodicidade: Periodicidade }[],
): number {
  return assinaturas.reduce((total, assinatura) => total + valorMensalEquivalente(assinatura), 0);
}

/** Soma anual (mensal×12 no mensal), regra do item 1.3. */
export function totalAnualDeAssinaturas(
  assinaturas: readonly { readonly valorCentavos: number; readonly periodicidade: Periodicidade }[],
): number {
  return assinaturas.reduce(
    (total, assinatura) =>
      total + (assinatura.periodicidade === 'anual' ? assinatura.valorCentavos : assinatura.valorCentavos * 12),
    0,
  );
}

/**
 * Custo por uso no mês = valor mensal equivalente / usos no mês (item 1.3).
 * `null` quando não houve uso no mês — "aparece sinalizada" (critério de
 * aceite da ESPECIFICACAO §6.2).
 */
export function custoPorUsoNoMes(
  valorMensalEquivalenteCentavos: number,
  usosNoMes: number,
): number | null {
  if (usosNoMes <= 0) return null;
  return Math.round(valorMensalEquivalenteCentavos / usosNoMes);
}

export interface AssinaturaParaCobranca {
  readonly valorCentavos: number;
  readonly periodicidade: Periodicidade;
  readonly proximaCobranca: string;
  readonly diaDeCobranca: number;
}

export interface CobrancaVencida {
  /** `AAAA-MM-DD` local: a data EXATA da cobrança vencida (nunca "hoje"). */
  readonly data: string;
}

export interface ResultadoDeCobrancasVencidas {
  /** Uma por cobrança vencida, da mais antiga para a mais recente (pendência 4 do plano: todas, cada uma na sua data). */
  readonly cobrancasVencidas: readonly CobrancaVencida[];
  /** A próxima data futura, já avançada por todas as cobranças vencidas. Igual a `proximaCobranca` quando nada venceu. */
  readonly novaProximaCobranca: string;
}

/** Salvaguarda contra laço infinito por dado corrompido (ex.: `diaDeCobranca` fora do intervalo já validado). */
const LIMITE_DE_ITERACOES = 1000;

/**
 * Regra do item 1.3 (ESPECIFICACAO §6.2, critério de aceite: "ao passar a
 * data de cobrança, o app gera automaticamente o lançamento de gasto
 * correspondente e avança a próxima data"). Devolve TODAS as cobranças
 * vencidas (`proximaCobranca <= hoje`), cada uma na sua data — várias
 * atrasadas (app sem abrir por meses) geram todas (pendência 4) — e a nova
 * `proximaCobranca`. Mensal avança 1 mês por vez; anual, 12; o dia âncora
 * (`diaDeCobranca`) nunca se perde entre meses mais curtos e mais longos
 * (`adicionarMeses`, `@/compartilhado`). Função pura: não grava nada, quem
 * chama decide o que fazer com o resultado.
 */
export function calcularCobrancasVencidas(
  assinatura: AssinaturaParaCobranca,
  hoje: string,
): ResultadoDeCobrancasVencidas {
  const passoEmMeses = assinatura.periodicidade === 'mensal' ? 1 : 12;
  const cobrancasVencidas: CobrancaVencida[] = [];
  let dataAtual = assinatura.proximaCobranca;
  let iteracoes = 0;

  while (dataAtual <= hoje && iteracoes < LIMITE_DE_ITERACOES) {
    cobrancasVencidas.push({ data: dataAtual });
    dataAtual = adicionarMeses(dataAtual, passoEmMeses, assinatura.diaDeCobranca);
    iteracoes += 1;
  }

  return { cobrancasVencidas, novaProximaCobranca: dataAtual };
}

export interface AssinaturaParaAviso {
  readonly proximaCobranca: string;
  readonly diasDeAviso: number;
}

/**
 * Aviso de renovação (item 1.4): assinaturas cuja próxima cobrança cai dentro
 * dos próximos `diasDeAviso` dias, incluindo hoje. Uma cobrança já vencida
 * (`proximaCobranca` no passado) não entra aqui — vira lançamento automático
 * antes (item 1.3), não aviso.
 */
export function assinaturasParaAvisoDeRenovacao<T extends AssinaturaParaAviso>(
  assinaturas: readonly T[],
  hoje: string,
): T[] {
  return assinaturas.filter((assinatura) => {
    const dias = diasEntreDatas(hoje, assinatura.proximaCobranca);
    return dias >= 0 && dias <= assinatura.diasDeAviso;
  });
}
