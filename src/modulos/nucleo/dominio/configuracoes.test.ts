/**
 * `validarConfiguracoes` e `aplicarMudancas` (ADR 0005 seção 6, item 0.5).
 * Puro: sem React, sem banco, sem relógio.
 */
import { describe, expect, it } from 'vitest';
import { CONFIGURACOES_PADRAO, aplicarMudancas, validarConfiguracoes } from './configuracoes';
import type { Configuracoes } from './configuracoes';

describe('validarConfiguracoes', () => {
  it('aprova as configurações padrão (lista vazia)', () => {
    expect(validarConfiguracoes(CONFIGURACOES_PADRAO)).toEqual([]);
  });

  it('reprova metaSemanalDeFocoEmMinutos negativa', () => {
    const problemas = validarConfiguracoes({
      ...CONFIGURACOES_PADRAO,
      metaSemanalDeFocoEmMinutos: -1,
    });
    expect(problemas).toContain(
      'metaSemanalDeFocoEmMinutos deve ser um inteiro maior ou igual a zero.',
    );
  });

  it('reprova metaSemanalDeFocoEmMinutos fracionária', () => {
    const problemas = validarConfiguracoes({
      ...CONFIGURACOES_PADRAO,
      metaSemanalDeFocoEmMinutos: 1.5,
    });
    expect(problemas.length).toBeGreaterThan(0);
  });

  it('aceita metaSemanalDeFocoEmMinutos zero (limite inferior válido)', () => {
    expect(
      validarConfiguracoes({ ...CONFIGURACOES_PADRAO, metaSemanalDeFocoEmMinutos: 0 }),
    ).toEqual([]);
  });

  it('reprova metaSemanalDeTreinos negativa', () => {
    const problemas = validarConfiguracoes({ ...CONFIGURACOES_PADRAO, metaSemanalDeTreinos: -1 });
    expect(problemas).toContain('metaSemanalDeTreinos deve ser um inteiro maior ou igual a zero.');
  });

  it('aceita orcamentoMensalEmCentavos nulo (sem orçamento definido)', () => {
    expect(
      validarConfiguracoes({ ...CONFIGURACOES_PADRAO, orcamentoMensalEmCentavos: null }),
    ).toEqual([]);
  });

  it('aceita orcamentoMensalEmCentavos zero', () => {
    expect(validarConfiguracoes({ ...CONFIGURACOES_PADRAO, orcamentoMensalEmCentavos: 0 })).toEqual(
      [],
    );
  });

  it('reprova orcamentoMensalEmCentavos negativo', () => {
    const problemas = validarConfiguracoes({
      ...CONFIGURACOES_PADRAO,
      orcamentoMensalEmCentavos: -100,
    });
    expect(problemas).toContain(
      'orcamentoMensalEmCentavos deve ser null ou um inteiro maior ou igual a zero.',
    );
  });

  it('reprova orcamentoMensalEmCentavos fracionário', () => {
    const problemas = validarConfiguracoes({
      ...CONFIGURACOES_PADRAO,
      orcamentoMensalEmCentavos: 10.5,
    });
    expect(problemas.length).toBeGreaterThan(0);
  });

  it('acumula um problema por campo inválido', () => {
    const problemas = validarConfiguracoes({
      ...CONFIGURACOES_PADRAO,
      metaSemanalDeFocoEmMinutos: -1,
      metaSemanalDeTreinos: -1,
      orcamentoMensalEmCentavos: -1,
    });
    expect(problemas).toHaveLength(3);
  });
});

describe('aplicarMudancas', () => {
  it('mescla mudanças parciais sobre as atuais', () => {
    const resultado = aplicarMudancas(CONFIGURACOES_PADRAO, { tema: 'escuro' });
    expect(resultado).toEqual({ ...CONFIGURACOES_PADRAO, tema: 'escuro' });
  });

  it('sem mudanças devolve o equivalente às atuais', () => {
    expect(aplicarMudancas(CONFIGURACOES_PADRAO, {})).toEqual(CONFIGURACOES_PADRAO);
  });

  it('mescla mais de um campo ao mesmo tempo', () => {
    const resultado = aplicarMudancas(CONFIGURACOES_PADRAO, {
      metaSemanalDeTreinos: 5,
      unidadeDePeso: 'lb',
    });
    expect(resultado).toEqual({
      ...CONFIGURACOES_PADRAO,
      metaSemanalDeTreinos: 5,
      unidadeDePeso: 'lb',
    });
  });

  it('é pura: não muta o objeto "atuais" recebido', () => {
    const atuais: Configuracoes = { ...CONFIGURACOES_PADRAO };
    const copiaParaComparar = { ...atuais };

    aplicarMudancas(atuais, { tema: 'escuro' });

    expect(atuais).toEqual(copiaParaComparar);
  });
});
