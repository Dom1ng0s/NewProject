/**
 * Dinheiro em centavos inteiros (nunca ponto flutuante em valor monetário
 * nem em cálculo intermediário). Este módulo só formata para exibição.
 */

function agruparMilhares(valorAbsoluto: number): string {
  return valorAbsoluto.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Formata centavos inteiros como reais: `formatarBRL(123456) === 'R$ 1.234,56'`. */
export function formatarBRL(centavos: number): string {
  const inteiro = Math.trunc(centavos);
  const negativo = inteiro < 0;
  const absoluto = Math.abs(inteiro);

  const reais = Math.floor(absoluto / 100);
  const partesCentavos = (absoluto % 100).toString().padStart(2, '0');

  const valorFormatado = `R$ ${agruparMilhares(reais)},${partesCentavos}`;

  return negativo ? `-${valorFormatado}` : valorFormatado;
}
