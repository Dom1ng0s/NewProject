/**
 * Regras puras de categorias de finanças (docs/ESPECIFICACAO.md §6.2: "Gasto
 * em 3 Toques"). Sem React, sem banco, sem relógio.
 */

/** Semeadas pela migração v2 (`src/persistencia/migracoes/v2-financas.ts`) — mantidas aqui só para referência/teste. */
export const NOMES_DE_CATEGORIAS_INICIAIS = [
  'Alimentação',
  'Transporte',
  'Lazer',
  'Estudos',
  'Moradia',
  'Outros',
] as const;

const TAMANHO_MAXIMO_DO_NOME = 40;

/**
 * Devolve a mensagem de problema (texto de desenvolvedor) ou `null` se o
 * nome é válido: não pode ficar em branco depois de `trim()`, nem passar de
 * 40 caracteres.
 */
export function problemaDeNomeDeCategoria(nome: string): string | null {
  const semEspacos = nome.trim();
  if (semEspacos === '') {
    return 'O nome da categoria não pode ficar em branco.';
  }
  if (semEspacos.length > TAMANHO_MAXIMO_DO_NOME) {
    return `O nome da categoria pode ter no máximo ${String(TAMANHO_MAXIMO_DO_NOME)} caracteres.`;
  }
  return null;
}
