import { describe, expect, it } from 'vitest';
import { gerarIdentificador } from './identificador';

describe('gerarIdentificador', () => {
  it('gera UUID v7 em sequência que ordena crescente como string', () => {
    const gerados = Array.from({ length: 50 }, () => gerarIdentificador());
    const ordenados = [...gerados].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    expect(gerados).toEqual(ordenados);
  });

  it('gera identificadores únicos no formato UUID', () => {
    const a = gerarIdentificador();
    const b = gerarIdentificador();

    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
