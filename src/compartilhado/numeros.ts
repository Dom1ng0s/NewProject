/**
 * Leitura de números inteiros digitados pelo usuário. Só formato — quem
 * decide se um valor negativo é aceito é a regra de negócio, não aqui.
 */

const PADRAO_DE_INTEIRO = /^-?\d+$/u;

/**
 * Lê um texto como inteiro: `'3'` → 3, `'03'` → 3, `'-2'` → -2. Texto vazio,
 * fora do formato (`^-?\d+$` após `trim()`), ou fora do intervalo de inteiro
 * seguro devolve `null`.
 */
export function lerInteiro(texto: string): number | null {
  const semEspacos = texto.trim();
  if (semEspacos === '') {
    return null;
  }

  if (!PADRAO_DE_INTEIRO.test(semEspacos)) {
    return null;
  }

  const valor = Number(semEspacos);
  if (!Number.isSafeInteger(valor)) {
    return null;
  }

  return Object.is(valor, -0) ? 0 : valor;
}
