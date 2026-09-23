import { describe, expect, it } from 'vitest';
import { formatarBRL, formatarReais, lerCentavosDeReais } from './dinheiro';

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

/** ADR 0008, seção 3.3/7, critério de aceite 6. */
describe('formatarReais', () => {
  it('formata 150000 centavos como "1.500,00" (sem R$)', () => {
    expect(formatarReais(150000)).toBe('1.500,00');
  });

  it('formata 5 centavos como "0,05"', () => {
    expect(formatarReais(5)).toBe('0,05');
  });
});

/**
 * Tabela completa do ADR 0008, seção 3.3, mais os casos extras do critério
 * de aceite 6 (`'0,10'`, `'1234,56'`, sem erro de ponto flutuante).
 */
describe('lerCentavosDeReais', () => {
  it.each([
    ['1500', 150000],
    ['1500,5', 150050],
    ['1500,50', 150050],
    ['1.500', 150000],
    ['1.500,00', 150000],
    ['12.5', 1250],
    ['12.50', 1250],
    ['R$ 1.500,00', 150000],
    ['  1500 ', 150000],
    ['-10', -1000],
  ])('lerCentavosDeReais(%j) === %j', (texto, esperado) => {
    expect(lerCentavosDeReais(texto)).toBe(esperado);
  });

  it.each([
    '1.2345',
    '1,234',
    '1.50.0',
    'abc',
    ',5',
    '1e3',
    '',
    '10.00,50',
    '12.5,3',
    '1.50,00',
    '1.5,00',
  ])('lerCentavosDeReais(%j) === null (formato não reconhecido)', (texto) => {
    expect(lerCentavosDeReais(texto)).toBeNull();
  });

  it('lê "0,10" como 10 centavos', () => {
    expect(lerCentavosDeReais('0,10')).toBe(10);
  });

  it('lê "1234,56" como 123456 centavos, sem erro de ponto flutuante', () => {
    expect(lerCentavosDeReais('1234,56')).toBe(123456);
  });

  it('"-0" normaliza para 0, sem -0 de ponto flutuante', () => {
    const resultado = lerCentavosDeReais('-0');
    expect(resultado).toBe(0);
    expect(Object.is(resultado, -0)).toBe(false);
  });
});
