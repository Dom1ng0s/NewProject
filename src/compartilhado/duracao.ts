/**
 * Duração em minutos inteiros. Este módulo lê e formata horas digitadas
 * pelo usuário (ex.: meta semanal de foco), nunca guarda nada por si.
 */

const PADRAO_DE_HORAS = /^(?<sinal>-)?(?<horas>\d+)(?:[,.](?<decimo>\d))?$/u;

/**
 * Lê um texto de horas (com no máximo uma casa decimal) e devolve minutos
 * inteiros: `'10'` → 600, `'7,5'` e `'7.5'` → 450, `'-1'` → -60. Texto vazio,
 * sem esse formato, ou com mais de uma casa decimal devolve `null`.
 */
export function lerHorasEmMinutos(texto: string): number | null {
  const semEspacos = texto.trim();
  if (semEspacos === '') {
    return null;
  }

  const combinacao = PADRAO_DE_HORAS.exec(semEspacos);
  if (combinacao?.groups === undefined) {
    return null;
  }

  const { sinal, horas, decimo } = combinacao.groups;

  const minutosDasHoras = Number(horas) * 60;
  const minutosDoDecimo = decimo === undefined ? 0 : Number(decimo) * 6;
  const totalDeMinutos = minutosDasHoras + minutosDoDecimo;

  if (!Number.isSafeInteger(totalDeMinutos)) {
    return null;
  }

  const comSinal = sinal === '-' ? -totalDeMinutos : totalDeMinutos;
  if (!Number.isSafeInteger(comSinal)) {
    return null;
  }

  return Object.is(comSinal, -0) ? 0 : comSinal;
}

/**
 * Formata minutos como horas, só para exibição, arredondando a uma casa
 * decimal: `600` → `'10'`, `450` → `'7,5'`, `605` → `'10,1'`.
 */
export function formatarMinutosEmHoras(minutos: number): string {
  const negativo = minutos < 0;
  const absoluto = Math.abs(minutos);

  const decimosTotais = Math.round(absoluto / 6);
  const horas = Math.floor(decimosTotais / 10);
  const decimo = decimosTotais % 10;

  const valorFormatado = decimo === 0 ? `${horas}` : `${horas},${decimo}`;

  return negativo && decimosTotais !== 0 ? `-${valorFormatado}` : valorFormatado;
}
