import { describe, expect, it } from 'vitest';
import { problemasDeLancamento, somarGastosEmCentavos } from './lancamentos';
import type { DadosDeLancamento } from './lancamentos';

function lancamento(parcial: Partial<DadosDeLancamento> = {}): DadosDeLancamento {
  return {
    tipo: 'gasto',
    valorCentavos: 1000,
    categoriaId: 'categoria-1',
    descricao: null,
    data: '2026-09-21',
    assinaturaId: null,
    ...parcial,
  };
}

describe('problemasDeLancamento', () => {
  it('lançamento válido não tem problemas', () => {
    expect(problemasDeLancamento(lancamento())).toEqual([]);
  });

  it('rejeita valor zero ou negativo', () => {
    expect(problemasDeLancamento(lancamento({ valorCentavos: 0 }))).not.toEqual([]);
    expect(problemasDeLancamento(lancamento({ valorCentavos: -100 }))).not.toEqual([]);
  });

  it('rejeita valor não inteiro (ponto flutuante nunca é dinheiro válido)', () => {
    expect(problemasDeLancamento(lancamento({ valorCentavos: 10.5 }))).not.toEqual([]);
  });

  it('rejeita categoriaId vazio', () => {
    expect(problemasDeLancamento(lancamento({ categoriaId: '' }))).not.toEqual([]);
    expect(problemasDeLancamento(lancamento({ categoriaId: '   ' }))).not.toEqual([]);
  });

  it('rejeita data que não existe no calendário (30 de fevereiro)', () => {
    expect(problemasDeLancamento(lancamento({ data: '2026-02-30' }))).not.toEqual([]);
  });

  it('aceita tipo "entrada" com os mesmos campos', () => {
    expect(problemasDeLancamento(lancamento({ tipo: 'entrada' }))).toEqual([]);
  });
});

describe('somarGastosEmCentavos', () => {
  it('soma só os lançamentos do tipo "gasto", ignorando entradas', () => {
    const total = somarGastosEmCentavos([
      { tipo: 'gasto', valorCentavos: 1000 },
      { tipo: 'entrada', valorCentavos: 500000 },
      { tipo: 'gasto', valorCentavos: 250 },
    ]);
    expect(total).toBe(1250);
  });

  it('lista vazia soma zero', () => {
    expect(somarGastosEmCentavos([])).toBe(0);
  });

  it('só entradas soma zero', () => {
    expect(somarGastosEmCentavos([{ tipo: 'entrada', valorCentavos: 999 }])).toBe(0);
  });
});
