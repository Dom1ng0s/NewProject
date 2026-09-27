import { describe, expect, it } from 'vitest';
import {
  assinaturasParaAvisoDeRenovacao,
  calcularCobrancasVencidas,
  custoPorUsoNoMes,
  diaDoMesDe,
  problemasDeAssinatura,
  totalAnualDeAssinaturas,
  totalMensalDeAssinaturas,
  valorMensalEquivalente,
} from './assinaturas';
import type { AssinaturaParaCobranca, DadosDeAssinatura } from './assinaturas';

function assinatura(parcial: Partial<DadosDeAssinatura> = {}): DadosDeAssinatura {
  return {
    nome: 'Streaming',
    valorCentavos: 2990,
    periodicidade: 'mensal',
    proximaCobranca: '2026-05-10',
    diasDeAviso: 3,
    categoriaId: 'categoria-1',
    diaDeCobranca: 10,
    ...parcial,
  };
}

describe('problemasDeAssinatura', () => {
  it('dados válidos: lista vazia', () => {
    expect(problemasDeAssinatura(assinatura())).toEqual([]);
  });

  it('nome vazio', () => {
    expect(problemasDeAssinatura(assinatura({ nome: '  ' }))).not.toEqual([]);
  });

  it('valor zero ou negativo', () => {
    expect(problemasDeAssinatura(assinatura({ valorCentavos: 0 }))).not.toEqual([]);
    expect(problemasDeAssinatura(assinatura({ valorCentavos: -100 }))).not.toEqual([]);
  });

  it('periodicidade fora de "mensal"/"anual"', () => {
    expect(
      problemasDeAssinatura(assinatura({ periodicidade: 'semanal' as never })),
    ).not.toEqual([]);
  });

  it('próxima cobrança inválida (30 de fevereiro)', () => {
    expect(problemasDeAssinatura(assinatura({ proximaCobranca: '2026-02-30' }))).not.toEqual([]);
  });

  it('dias de aviso negativo', () => {
    expect(problemasDeAssinatura(assinatura({ diasDeAviso: -1 }))).not.toEqual([]);
  });

  it('categoria vazia', () => {
    expect(problemasDeAssinatura(assinatura({ categoriaId: '' }))).not.toEqual([]);
  });

  it('dia de cobrança fora de 1-31', () => {
    expect(problemasDeAssinatura(assinatura({ diaDeCobranca: 0 }))).not.toEqual([]);
    expect(problemasDeAssinatura(assinatura({ diaDeCobranca: 32 }))).not.toEqual([]);
  });
});

describe('diaDoMesDe', () => {
  it('extrai o dia (1-31) de uma data AAAA-MM-DD', () => {
    expect(diaDoMesDe('2026-05-10')).toBe(10);
    expect(diaDoMesDe('2026-01-31')).toBe(31);
  });
});

describe('valorMensalEquivalente', () => {
  it('mensal: o próprio valor', () => {
    expect(valorMensalEquivalente({ valorCentavos: 2990, periodicidade: 'mensal' })).toBe(2990);
  });

  it('anual: valor / 12, arredondado', () => {
    expect(valorMensalEquivalente({ valorCentavos: 12000, periodicidade: 'anual' })).toBe(1000);
    // 10000/12 = 833.33... -> 833
    expect(valorMensalEquivalente({ valorCentavos: 10000, periodicidade: 'anual' })).toBe(833);
  });
});

describe('totalMensalDeAssinaturas e totalAnualDeAssinaturas', () => {
  const assinaturas = [
    { valorCentavos: 1000, periodicidade: 'mensal' as const },
    { valorCentavos: 12000, periodicidade: 'anual' as const },
  ];

  it('total mensal: anual/12 somado ao mensal', () => {
    expect(totalMensalDeAssinaturas(assinaturas)).toBe(1000 + 1000);
  });

  it('total anual: mensal×12 somado ao anual', () => {
    expect(totalAnualDeAssinaturas(assinaturas)).toBe(1000 * 12 + 12000);
  });

  it('lista vazia soma zero nos dois', () => {
    expect(totalMensalDeAssinaturas([])).toBe(0);
    expect(totalAnualDeAssinaturas([])).toBe(0);
  });
});

describe('custoPorUsoNoMes', () => {
  it('divide o valor mensal equivalente pelos usos, arredondado', () => {
    expect(custoPorUsoNoMes(3000, 3)).toBe(1000);
    expect(custoPorUsoNoMes(1000, 3)).toBe(333); // 333.33... -> 333
  });

  it('zero usos no mês: null (sinalizada)', () => {
    expect(custoPorUsoNoMes(3000, 0)).toBeNull();
  });

  it('usos negativo (dado inconsistente): também null, nunca divide por negativo', () => {
    expect(custoPorUsoNoMes(3000, -1)).toBeNull();
  });
});

describe('calcularCobrancasVencidas — item 1.3 (ESPECIFICACAO §6.2, critério de aceite)', () => {
  function paraCalculo(parcial: Partial<AssinaturaParaCobranca> = {}): AssinaturaParaCobranca {
    return {
      valorCentavos: 2990,
      periodicidade: 'mensal',
      proximaCobranca: '2026-05-10',
      diaDeCobranca: 10,
      ...parcial,
    };
  }

  it('nada vencido: lista vazia, proximaCobranca inalterada', () => {
    const resultado = calcularCobrancasVencidas(paraCalculo({ proximaCobranca: '2026-05-10' }), '2026-05-01');
    expect(resultado).toEqual({ cobrancasVencidas: [], novaProximaCobranca: '2026-05-10' });
  });

  it('exatamente hoje: vencida (inclusive)', () => {
    const resultado = calcularCobrancasVencidas(paraCalculo({ proximaCobranca: '2026-05-10' }), '2026-05-10');
    expect(resultado.cobrancasVencidas).toEqual([{ data: '2026-05-10' }]);
    expect(resultado.novaProximaCobranca).toBe('2026-06-10');
  });

  it('uma cobrança vencida (mensal): gera 1 lançamento e avança 1 mês', () => {
    const resultado = calcularCobrancasVencidas(paraCalculo({ proximaCobranca: '2026-04-10' }), '2026-04-15');
    expect(resultado.cobrancasVencidas).toEqual([{ data: '2026-04-10' }]);
    expect(resultado.novaProximaCobranca).toBe('2026-05-10');
  });

  it('várias cobranças atrasadas (app fechado por meses): gera TODAS, cada uma na sua data (pendência 4)', () => {
    const resultado = calcularCobrancasVencidas(paraCalculo({ proximaCobranca: '2026-01-10' }), '2026-04-20');
    expect(resultado.cobrancasVencidas).toEqual([
      { data: '2026-01-10' },
      { data: '2026-02-10' },
      { data: '2026-03-10' },
      { data: '2026-04-10' },
    ]);
    expect(resultado.novaProximaCobranca).toBe('2026-05-10');
  });

  it('anual: avança 12 meses por cobrança', () => {
    const resultado = calcularCobrancasVencidas(
      paraCalculo({ periodicidade: 'anual', proximaCobranca: '2025-04-10', diaDeCobranca: 10 }),
      '2026-04-20',
    );
    expect(resultado.cobrancasVencidas).toEqual([{ data: '2025-04-10' }]);
    expect(resultado.novaProximaCobranca).toBe('2026-04-10');
  });

  it('dia âncora 31: cai no último dia de um mês mais curto sem perder a âncora no mês seguinte', () => {
    // Vencida em 31/01; fevereiro é comum (28 dias) -> cai em 28/02; a
    // próxima (março) volta para o dia 31, não fica presa em 28.
    const resultado = calcularCobrancasVencidas(
      paraCalculo({ proximaCobranca: '2026-01-31', diaDeCobranca: 31 }),
      '2026-03-01',
    );
    expect(resultado.cobrancasVencidas).toEqual([{ data: '2026-01-31' }, { data: '2026-02-28' }]);
    expect(resultado.novaProximaCobranca).toBe('2026-03-31');
  });
});

describe('assinaturasParaAvisoDeRenovacao — item 1.4', () => {
  it('dentro da janela de diasDeAviso (inclusive o limite): entra', () => {
    const assinaturas = [{ proximaCobranca: '2026-04-13', diasDeAviso: 3 }];
    expect(assinaturasParaAvisoDeRenovacao(assinaturas, '2026-04-10')).toEqual(assinaturas);
  });

  it('um dia além da janela: não entra', () => {
    const assinaturas = [{ proximaCobranca: '2026-04-14', diasDeAviso: 3 }];
    expect(assinaturasParaAvisoDeRenovacao(assinaturas, '2026-04-10')).toEqual([]);
  });

  it('cobrança hoje: entra (dias = 0)', () => {
    const assinaturas = [{ proximaCobranca: '2026-04-10', diasDeAviso: 0 }];
    expect(assinaturasParaAvisoDeRenovacao(assinaturas, '2026-04-10')).toEqual(assinaturas);
  });

  it('cobrança já vencida (passado): não entra — vira lançamento automático, não aviso', () => {
    const assinaturas = [{ proximaCobranca: '2026-04-05', diasDeAviso: 30 }];
    expect(assinaturasParaAvisoDeRenovacao(assinaturas, '2026-04-10')).toEqual([]);
  });

  it('diasDeAviso zero e cobrança amanhã: não entra', () => {
    const assinaturas = [{ proximaCobranca: '2026-04-11', diasDeAviso: 0 }];
    expect(assinaturasParaAvisoDeRenovacao(assinaturas, '2026-04-10')).toEqual([]);
  });
});
