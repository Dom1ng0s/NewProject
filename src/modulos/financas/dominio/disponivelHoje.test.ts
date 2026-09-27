import { describe, expect, it } from 'vitest';
import { assinaturasAVencerNoMes, disponivelHoje } from './disponivelHoje';
import type { AssinaturaParaCalculo, ParametrosDeDisponivelHoje } from './disponivelHoje';

function parametros(parcial: Partial<ParametrosDeDisponivelHoje> = {}): ParametrosDeDisponivelHoje {
  return {
    orcamentoMensalEmCentavos: 300000,
    hoje: '2026-04-01',
    gastosDoMesAteOntemEmCentavos: 0,
    gastosDeHojeEmCentavos: 0,
    assinaturas: [],
    ...parcial,
  };
}

describe('disponivelHoje — regra 7.3', () => {
  it('orçamento null: devolve null sem calcular nada', () => {
    expect(disponivelHoje(parametros({ orcamentoMensalEmCentavos: null }))).toBeNull();
  });

  it('primeiro dia do mês: cotaDiaria = orçamento inteiro / dias do mês', () => {
    // Abril tem 30 dias; orçamento escolhido para dar cota redonda de 100.
    const resultado = disponivelHoje(
      parametros({ orcamentoMensalEmCentavos: 3000, hoje: '2026-04-01' }),
    );
    expect(resultado).toBe(100);
  });

  it('último dia do mês: diasRestantes = 1, cotaDiaria = restanteMes inteiro', () => {
    const resultado = disponivelHoje(
      parametros({
        orcamentoMensalEmCentavos: 100000,
        hoje: '2026-04-30',
        gastosDoMesAteOntemEmCentavos: 95000,
      }),
    );
    // restanteMes = 100000 - 95000 = 5000; diasRestantes = 1 -> cotaDiaria = 5000
    expect(resultado).toBe(5000);
  });

  it.each([
    ['fevereiro de ano comum (28 dias)', '2026-02-01', 2800],
    ['fevereiro de ano bissexto (29 dias)', '2028-02-01', 2900],
    ['mês de 30 dias (abril)', '2026-04-01', 3000],
    ['mês de 31 dias (janeiro)', '2026-01-01', 3100],
  ])('%s: cotaDiaria = orçamento / dias do mês', (_descricao, hoje, orcamentoMensalEmCentavos) => {
    const resultado = disponivelHoje(parametros({ hoje, orcamentoMensalEmCentavos }));
    expect(resultado).toBe(100);
  });

  it('pode ficar negativo quando os gastos já passaram do orçamento (valor excedido)', () => {
    const resultado = disponivelHoje(
      parametros({
        orcamentoMensalEmCentavos: 100000,
        hoje: '2026-04-15',
        gastosDoMesAteOntemEmCentavos: 200000,
      }),
    );
    expect(resultado).toBeLessThan(0);
  });

  it('desconta os gastos de hoje da cota diária', () => {
    const resultado = disponivelHoje(
      parametros({
        orcamentoMensalEmCentavos: 3000,
        hoje: '2026-04-01',
        gastosDeHojeEmCentavos: 40,
      }),
    );
    // cotaDiaria = 100; disponivel = 100 - 40 = 60
    expect(resultado).toBe(60);
  });

  it('arredondamento sempre em centavos inteiros (Math.round na cota diária)', () => {
    const resultado = disponivelHoje(
      parametros({
        orcamentoMensalEmCentavos: 100,
        hoje: '2026-04-28', // diasRestantes = 30 - 28 + 1 = 3
      }),
    );
    // cotaDiaria = round(100/3) = round(33.33...) = 33
    expect(resultado).toBe(33);
  });

  it('desconta assinaturasAVencerNoMes do restante do mês', () => {
    const assinaturas: readonly AssinaturaParaCalculo[] = [
      { valorCentavos: 500, proximaCobranca: '2026-04-20' },
    ];
    const resultado = disponivelHoje(
      parametros({ orcamentoMensalEmCentavos: 3000, hoje: '2026-04-01', assinaturas }),
    );
    // restanteMes = 3000 - 500 = 2500; diasRestantes = 30 -> cotaDiaria = round(2500/30) = 83
    expect(resultado).toBe(83);
  });
});

describe('assinaturasAVencerNoMes — pendência 2 do plano', () => {
  it('soma só cobranças do mês corrente ainda não passadas (>= hoje)', () => {
    const assinaturas: readonly AssinaturaParaCalculo[] = [
      { valorCentavos: 1000, proximaCobranca: '2026-04-20' }, // dentro do mês, ainda não passou
      { valorCentavos: 2000, proximaCobranca: '2026-04-01' }, // dentro do mês, mas já passou (hoje é dia 10)
      { valorCentavos: 3000, proximaCobranca: '2026-05-05' }, // mês seguinte
      { valorCentavos: 4000, proximaCobranca: '2026-04-10' }, // exatamente hoje: inclusive
    ];
    expect(assinaturasAVencerNoMes(assinaturas, '2026-04-10')).toBe(1000 + 4000);
  });

  it('lista vazia soma zero', () => {
    expect(assinaturasAVencerNoMes([], '2026-04-10')).toBe(0);
  });

  it('nenhuma assinatura no mês corrente soma zero', () => {
    const assinaturas: readonly AssinaturaParaCalculo[] = [
      { valorCentavos: 1000, proximaCobranca: '2026-05-01' },
      { valorCentavos: 1000, proximaCobranca: '2026-03-01' },
    ];
    expect(assinaturasAVencerNoMes(assinaturas, '2026-04-10')).toBe(0);
  });
});
