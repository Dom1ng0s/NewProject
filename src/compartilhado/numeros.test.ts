/**
 * `lerInteiro` (ADR 0008, seção 7, critério de aceite 6). Puro: sem React,
 * sem banco, sem relógio.
 */
import { describe, expect, it } from 'vitest';
import { lerInteiro } from './numeros';

describe('lerInteiro', () => {
  it.each([
    ['3', 3],
    ['03', 3],
    ['-2', -2],
  ])('lerInteiro(%j) === %j', (texto, esperado) => {
    expect(lerInteiro(texto)).toBe(esperado);
  });

  it.each(['2,5', '', '9007199254740993'])(
    'lerInteiro(%j) === null (fora do formato ou fora do inteiro seguro)',
    (texto) => {
      expect(lerInteiro(texto)).toBeNull();
    },
  );

  it('"-0" normaliza para 0, sem -0 de ponto flutuante', () => {
    const resultado = lerInteiro('-0');
    expect(resultado).toBe(0);
    expect(Object.is(resultado, -0)).toBe(false);
  });
});
