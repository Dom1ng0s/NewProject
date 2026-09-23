/**
 * Dinheiro em centavos inteiros (nunca ponto flutuante em valor monetário
 * nem em cálculo intermediário). Este módulo só formata para exibição.
 */

function agruparMilhares(valorAbsoluto: number): string {
  return valorAbsoluto.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formata centavos inteiros como reais, sem o prefixo `R$`:
 * `formatarReais(150000) === '1.500,00'`, `formatarReais(5) === '0,05'`.
 */
export function formatarReais(centavos: number): string {
  const inteiro = Math.trunc(centavos);
  const negativo = inteiro < 0;
  const absoluto = Math.abs(inteiro);

  const reais = Math.floor(absoluto / 100);
  const partesCentavos = (absoluto % 100).toString().padStart(2, '0');

  const valorFormatado = `${agruparMilhares(reais)},${partesCentavos}`;

  return negativo ? `-${valorFormatado}` : valorFormatado;
}

/**
 * Formata centavos inteiros como reais com o prefixo `R$`:
 * `formatarBRL(123456) === 'R$ 1.234,56'`, `formatarBRL(-500) === '-R$ 5,00'`
 * (o sinal fica antes de `R$`, não dentro do valor).
 */
export function formatarBRL(centavos: number): string {
  const textoEmReais = formatarReais(centavos);
  const negativo = textoEmReais.startsWith('-');

  return negativo ? `-R$ ${textoEmReais.slice(1)}` : `R$ ${textoEmReais}`;
}

const PADRAO_DE_VALOR_EM_REAIS =
  /^(?<sinal>-)?(?:(?:(?<milharPonto>\d{1,3}(?:\.\d{3})+)|(?<semSeparador>\d+))(?:,(?<centavosVirgula>\d{1,2}))?|(?<pontoDecimal>\d+\.\d{1,2}))$/u;

/**
 * Lê um texto em formato brasileiro (ou tolerante) de reais e devolve
 * centavos inteiros, ou `null` se o texto não é um valor reconhecido
 * (inclusive vazio). Tabela completa: ADR 0008, seção 3.3.
 *
 * A conversão é feita sobre o texto (dígitos da parte inteira e da parte
 * decimal), nunca `parseFloat(...) * 100` — isso reintroduziria erro de
 * ponto flutuante, proibido para valores monetários.
 */
export function lerCentavosDeReais(texto: string): number | null {
  const semEspacos = texto.trim().replace(/\s+/gu, '');
  if (semEspacos === '') {
    return null;
  }

  const semPrefixo = semEspacos.replace(/^R\$/iu, '');
  if (semPrefixo === '') {
    return null;
  }

  const combinacao = PADRAO_DE_VALOR_EM_REAIS.exec(semPrefixo);
  if (combinacao?.groups === undefined) {
    return null;
  }

  const { sinal, milharPonto, pontoDecimal, semSeparador, centavosVirgula } = combinacao.groups;

  // A vírgula decimal (`centavosVirgula`) só pode casar depois de
  // `milharPonto` ou `semSeparador`: a alternância da regex coloca
  // `pontoDecimal` (ponto como decimal, ex.: `12.5`) num ramo separado, sem
  // o grupo da vírgula depois. Por isso um texto com ponto decimal seguido
  // de vírgula (`'12.5,3'`) não casa a regex inteira e cai no `null` antes
  // de chegar aqui — os ramos abaixo são mutuamente exclusivos.
  let digitosInteiros: string;
  let digitosCentavos: string;

  if (pontoDecimal !== undefined) {
    const indiceDoPonto = pontoDecimal.indexOf('.');
    digitosInteiros = pontoDecimal.slice(0, indiceDoPonto);
    digitosCentavos = pontoDecimal.slice(indiceDoPonto + 1).padEnd(2, '0');
  } else {
    digitosInteiros = (milharPonto ?? semSeparador ?? '').replace(/\./gu, '');
    digitosCentavos = (centavosVirgula ?? '').padEnd(2, '0');
  }

  const totalDeCentavosTexto = `${digitosInteiros}${digitosCentavos}`;
  if (!/^\d+$/u.test(totalDeCentavosTexto)) {
    return null;
  }

  const totalDeCentavos = Number(totalDeCentavosTexto);
  if (!Number.isSafeInteger(totalDeCentavos)) {
    return null;
  }

  const comSinal = sinal === '-' ? -totalDeCentavos : totalDeCentavos;
  if (!Number.isSafeInteger(comSinal)) {
    return null;
  }

  return Object.is(comSinal, -0) ? 0 : comSinal;
}
