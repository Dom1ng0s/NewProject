import { describe, expect, it } from 'vitest';
import {
  problemasDeCofrinho,
  problemasDeMovimentoDeCofrinho,
  projetarConclusaoDoCofrinho,
  saldoDoCofrinho,
} from './cofrinhos';
import type { DadosDeCofrinho, DadosDeMovimentoDeCofrinho, ParametrosDeProjecaoDeCofrinho } from './cofrinhos';

function cofrinho(parcial: Partial<DadosDeCofrinho> = {}): DadosDeCofrinho {
  return {
    nome: 'Viagem',
    alvoCentavos: 500000,
    prazo: null,
    criadoEm: '2026-01-01',
    ...parcial,
  };
}

function movimento(parcial: Partial<DadosDeMovimentoDeCofrinho> = {}): DadosDeMovimentoDeCofrinho {
  return {
    cofrinhoId: 'cofrinho-1',
    valorCentavos: 1000,
    data: '2026-04-10',
    ...parcial,
  };
}

describe('problemasDeCofrinho', () => {
  it('dados válidos: lista vazia', () => {
    expect(problemasDeCofrinho(cofrinho())).toEqual([]);
  });

  it('nome vazio', () => {
    expect(problemasDeCofrinho(cofrinho({ nome: '  ' }))).not.toEqual([]);
  });

  it('alvo zero ou negativo', () => {
    expect(problemasDeCofrinho(cofrinho({ alvoCentavos: 0 }))).not.toEqual([]);
    expect(problemasDeCofrinho(cofrinho({ alvoCentavos: -100 }))).not.toEqual([]);
  });

  it('prazo null é válido (sem prazo)', () => {
    expect(problemasDeCofrinho(cofrinho({ prazo: null }))).toEqual([]);
  });

  it('prazo inválido (30 de fevereiro)', () => {
    expect(problemasDeCofrinho(cofrinho({ prazo: '2026-02-30' }))).not.toEqual([]);
  });

  it('criadoEm inválido', () => {
    expect(problemasDeCofrinho(cofrinho({ criadoEm: 'não é data' }))).not.toEqual([]);
  });
});

describe('problemasDeMovimentoDeCofrinho', () => {
  it('depósito e retirada válidos: lista vazia', () => {
    expect(problemasDeMovimentoDeCofrinho(movimento({ valorCentavos: 1000 }))).toEqual([]);
    expect(problemasDeMovimentoDeCofrinho(movimento({ valorCentavos: -500 }))).toEqual([]);
  });

  it('valor zero é inválido (nem depósito nem retirada)', () => {
    expect(problemasDeMovimentoDeCofrinho(movimento({ valorCentavos: 0 }))).not.toEqual([]);
  });

  it('sem cofrinhoId', () => {
    expect(problemasDeMovimentoDeCofrinho(movimento({ cofrinhoId: '' }))).not.toEqual([]);
  });

  it('data inválida', () => {
    expect(problemasDeMovimentoDeCofrinho(movimento({ data: '2026-13-01' }))).not.toEqual([]);
  });
});

describe('saldoDoCofrinho', () => {
  it('soma depósitos e retiradas (com sinal)', () => {
    expect(
      saldoDoCofrinho([{ valorCentavos: 1000 }, { valorCentavos: 500 }, { valorCentavos: -200 }]),
    ).toBe(1300);
  });

  it('sem movimentos: zero', () => {
    expect(saldoDoCofrinho([])).toBe(0);
  });
});

describe('projetarConclusaoDoCofrinho — regra 7.4', () => {
  function parametros(
    parcial: Partial<ParametrosDeProjecaoDeCofrinho> = {},
  ): ParametrosDeProjecaoDeCofrinho {
    return {
      alvoCentavos: 100000,
      saldoAtualCentavos: 0,
      criadoEm: '2026-01-01',
      hoje: '2026-04-01', // 90 dias desde a criação -> janela cheia de 8 semanas (56 dias)
      movimentos: [],
      ...parcial,
    };
  }

  it('alvo já atingido: "concluido", nunca uma data', () => {
    const resultado = projetarConclusaoDoCofrinho(
      parametros({ alvoCentavos: 1000, saldoAtualCentavos: 1000 }),
    );
    expect(resultado).toEqual({ tipo: 'concluido' });
  });

  it('saldo além do alvo: também "concluido"', () => {
    const resultado = projetarConclusaoDoCofrinho(
      parametros({ alvoCentavos: 1000, saldoAtualCentavos: 5000 }),
    );
    expect(resultado).toEqual({ tipo: 'concluido' });
  });

  it('cofrinho criado hoje (sem histórico): "sem projeção"', () => {
    const resultado = projetarConclusaoDoCofrinho(
      parametros({ criadoEm: '2026-04-01', hoje: '2026-04-01', movimentos: [{ valorCentavos: 100, data: '2026-04-01' }] }),
    );
    expect(resultado).toEqual({ tipo: 'semProjecao' });
  });

  it('média líquida zero (depósitos == retiradas): "sem projeção"', () => {
    const resultado = projetarConclusaoDoCofrinho(
      parametros({
        movimentos: [
          { valorCentavos: 1000, data: '2026-03-20' },
          { valorCentavos: -1000, data: '2026-03-25' },
        ],
      }),
    );
    expect(resultado).toEqual({ tipo: 'semProjecao' });
  });

  it('média líquida negativa (mais retirada que depósito): "sem projeção"', () => {
    const resultado = projetarConclusaoDoCofrinho(
      parametros({
        movimentos: [
          { valorCentavos: 1000, data: '2026-03-20' },
          { valorCentavos: -2000, data: '2026-03-25' },
        ],
      }),
    );
    expect(resultado).toEqual({ tipo: 'semProjecao' });
  });

  it('menos de 8 semanas desde a criação: usa a janela real (não 8 semanas fixas)', () => {
    // Criado há 21 dias (3 semanas); um único depósito de 2100 -> média 700/semana.
    const resultado = projetarConclusaoDoCofrinho(
      parametros({
        alvoCentavos: 100000,
        saldoAtualCentavos: 2100,
        criadoEm: '2026-03-11',
        hoje: '2026-04-01',
        movimentos: [{ valorCentavos: 2100, data: '2026-03-15' }],
      }),
    );
    // faltante = 97900; média = 2100/3 = 700/semana; semanas = 97900/700 = 139.857...;
    // dias = round(139.857...*7) = 979 (97900*7/700 = 979 exato).
    expect(resultado).toEqual({ tipo: 'data', data: somarDiasEsperado('2026-04-01', 979) });
  });

  it('janela de 8 semanas ignora depósito anterior a ela', () => {
    const resultado = projetarConclusaoDoCofrinho(
      parametros({
        alvoCentavos: 100000,
        saldoAtualCentavos: 60000, // saldo total inclui o depósito antigo, mas não entra na média
        criadoEm: '2025-01-01', // bem antes da janela de 8 semanas
        hoje: '2026-04-01',
        movimentos: [
          { valorCentavos: 59000, data: '2026-01-01' }, // fora da janela de 56 dias
          { valorCentavos: 1000, data: '2026-03-30' }, // dentro da janela
        ],
      }),
    );
    // média = 1000 / 8 semanas = 125/semana; faltante = 40000
    // semanas = 320; dias = round(320*7) = 2240
    expect(resultado).toEqual({ tipo: 'data', data: somarDiasEsperado('2026-04-01', 2240) });
  });

  it('arredondamento de data: semanas fracionárias arredondam os dias para o inteiro mais próximo', () => {
    const resultado = projetarConclusaoDoCofrinho(
      parametros({
        alvoCentavos: 1700,
        saldoAtualCentavos: 0,
        criadoEm: '2026-03-04', // 28 dias antes de "hoje" = 4 semanas
        hoje: '2026-04-01',
        movimentos: [{ valorCentavos: 1000, data: '2026-03-10' }],
      }),
    );
    // média = 1000/4 = 250/semana; faltante = 1700; semanas = 6.8; dias = round(47.6) = 48
    expect(resultado).toEqual({ tipo: 'data', data: somarDiasEsperado('2026-04-01', 48) });
  });
});

// Pequeno auxiliar só para os testes acima não duplicarem a aritmética de data na mão.
function somarDiasEsperado(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const instante = new Date(ano as number, (mes as number) - 1, (dia as number) + dias, 12);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${instante.getFullYear()}-${pad(instante.getMonth() + 1)}-${pad(instante.getDate())}`;
}
