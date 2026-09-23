/**
 * `lerHorasEmMinutos` e `formatarMinutosEmHoras` (ADR 0008, seção 3.1/7,
 * critério de aceite 6). Puro: sem React, sem banco, sem relógio.
 */
import { describe, expect, it } from 'vitest';
import { formatarMinutosEmHoras, lerHorasEmMinutos } from './duracao';

describe('lerHorasEmMinutos', () => {
  it.each([
    ['10', 600],
    ['7,5', 450],
    ['7.5', 450],
    ['0', 0],
    ['-1', -60],
  ])('lerHorasEmMinutos(%j) === %j', (texto, esperado) => {
    expect(lerHorasEmMinutos(texto)).toBe(esperado);
  });

  it.each(['7,25', '', 'abc'])(
    'lerHorasEmMinutos(%j) === null (formato não reconhecido)',
    (texto) => {
      expect(lerHorasEmMinutos(texto)).toBeNull();
    },
  );

  it('"-0" normaliza para 0, sem -0 de ponto flutuante', () => {
    const resultado = lerHorasEmMinutos('-0');
    expect(resultado).toBe(0);
    expect(Object.is(resultado, -0)).toBe(false);
  });
});

describe('formatarMinutosEmHoras', () => {
  it('600 minutos === "10"', () => {
    expect(formatarMinutosEmHoras(600)).toBe('10');
  });

  it('450 minutos === "7,5"', () => {
    expect(formatarMinutosEmHoras(450)).toBe('7,5');
  });

  it('605 minutos (não múltiplo de 6) arredonda a uma casa: "10,1"', () => {
    expect(formatarMinutosEmHoras(605)).toBe('10,1');
  });

  it('0 minutos === "0"', () => {
    expect(formatarMinutosEmHoras(0)).toBe('0');
  });
});
