import { describe, expect, it } from 'vitest';
import { formatarBRL } from './dinheiro';

describe('formatarBRL', () => {
  it('formata centavos inteiros como reais', () => {
    expect(formatarBRL(123456)).toBe('R$ 1.234,56');
  });

  it('formata valores negativos', () => {
    expect(formatarBRL(-500)).toBe('-R$ 5,00');
  });

  it('formata zero', () => {
    expect(formatarBRL(0)).toBe('R$ 0,00');
  });
});
