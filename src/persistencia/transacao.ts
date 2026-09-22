import { db } from './db';
import type { NomeDeTabela } from './db';

/**
 * Executa `operacao` numa transação de leitura e escrita. Se `operacao`
 * lançar, NADA é gravado (especificação, seção 8: gravações atômicas).
 *
 * Cuidados obrigatórios dentro da operação:
 *  - só aguardar promessas do Dexie; `fetch`, `setTimeout` ou qualquer
 *    promessa de fora perde a zona da transação e o Dexie a fecha antes da
 *    hora;
 *  - calcular ids, instantes e valores ANTES de entrar (via `criarRegistro`/
 *    `atualizarRegistro`/`marcarComoExcluido`);
 *  - uma chamada aninhada só é absorvida pela transação de fora se as
 *    tabelas dela forem um subconjunto das tabelas de fora.
 *
 * Só o modo `rw`: a variante de leitura (para um export consistente) nasce
 * no item 0.6, se precisar. Escrita de tabela única pode usar `put` direto
 * (o IndexedDB já é atômico por operação); use `emTransacao` só quando mais
 * de uma tabela é tocada na mesma operação lógica.
 */
export function emTransacao<T>(
  tabelas: readonly NomeDeTabela[],
  operacao: () => Promise<T>,
): Promise<T> {
  return db.transaction('rw', tabelas as readonly string[], operacao);
}
