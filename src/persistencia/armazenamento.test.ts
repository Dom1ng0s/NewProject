/**
 * Mitigação do risco técnico 3 (ADR 0005, critério de aceite 15): nenhum
 * arquivo de `src/persistencia/` fica sem teste, nem mesmo detecção de
 * recurso que não lança.
 *
 * Ambiente `node` do Vitest expõe um `navigator` global (getter apenas,
 * sem `set`), mas o objeto devolvido por esse getter aceita novas
 * propriedades normalmente — por isso `navigator.storage = { ... }`
 * funciona para simular a API sem precisar de `vi.stubGlobal`. O `delete`
 * no `afterEach` devolve o ambiente ao estado original (sem `storage`),
 * já que o Node não define essa propriedade por padrão.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { solicitarArmazenamentoPersistente } from './armazenamento';

afterEach(() => {
  delete (navigator as { storage?: unknown }).storage;
});

describe('solicitarArmazenamentoPersistente', () => {
  it('devolve false quando o navegador não tem a API (ambiente atual, sem mock)', async () => {
    expect(navigator.storage).toBeUndefined();

    await expect(solicitarArmazenamentoPersistente()).resolves.toBe(false);
  });

  it('devolve true quando navigator.storage.persist() concede o pedido', async () => {
    (navigator as unknown as { storage: { persist: () => Promise<boolean> } }).storage = {
      persist: () => Promise.resolve(true),
    };

    await expect(solicitarArmazenamentoPersistente()).resolves.toBe(true);
  });

  it('devolve false quando navigator.storage.persist() resolve undefined (cobre o `?? false`)', async () => {
    (navigator as unknown as { storage: { persist: () => Promise<undefined> } }).storage = {
      persist: () => Promise.resolve(undefined),
    };

    await expect(solicitarArmazenamentoPersistente()).resolves.toBe(false);
  });
});
