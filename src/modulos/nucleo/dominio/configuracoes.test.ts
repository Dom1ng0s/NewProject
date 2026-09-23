/**
 * `validarConfiguracoes` e `aplicarMudancas` (ADR 0005 seção 6, item 0.5).
 * Puro: sem React, sem banco, sem relógio.
 */
import { describe, expect, it } from 'vitest';
import {
  CONFIGURACOES_PADRAO,
  aplicarMudancas,
  problemasDeConfiguracoes,
  validarConfiguracoes,
} from './configuracoes';
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

/**
 * `problemasDeConfiguracoes` (ADR 0008, seção 4/12, critério de aceite 5):
 * fonte única das regras, devolve problemas estruturados. As mensagens são as
 * mesmas já verificadas acima via `validarConfiguracoes`.
 */
describe('problemasDeConfiguracoes', () => {
  it('configurações padrão: lista vazia', () => {
    expect(problemasDeConfiguracoes(CONFIGURACOES_PADRAO)).toEqual([]);
  });

  it('metaSemanalDeFocoEmMinutos: -1 gera um problema {campo, codigo: "negativo"}', () => {
    const problemas = problemasDeConfiguracoes({
      ...CONFIGURACOES_PADRAO,
      metaSemanalDeFocoEmMinutos: -1,
    });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatchObject({
      campo: 'metaSemanalDeFocoEmMinutos',
      codigo: 'negativo',
    });
  });

  it('metaSemanalDeFocoEmMinutos: 1.5 gera um problema com codigo "naoEhInteiro"', () => {
    const problemas = problemasDeConfiguracoes({
      ...CONFIGURACOES_PADRAO,
      metaSemanalDeFocoEmMinutos: 1.5,
    });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatchObject({
      campo: 'metaSemanalDeFocoEmMinutos',
      codigo: 'naoEhInteiro',
    });
  });

  it('metaSemanalDeTreinos: -1 gera um problema com codigo "negativo"', () => {
    const problemas = problemasDeConfiguracoes({
      ...CONFIGURACOES_PADRAO,
      metaSemanalDeTreinos: -1,
    });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatchObject({ campo: 'metaSemanalDeTreinos', codigo: 'negativo' });
  });

  it('orcamentoMensalEmCentavos: null e 0 não geram problema (lista vazia)', () => {
    expect(
      problemasDeConfiguracoes({ ...CONFIGURACOES_PADRAO, orcamentoMensalEmCentavos: null }),
    ).toEqual([]);
    expect(
      problemasDeConfiguracoes({ ...CONFIGURACOES_PADRAO, orcamentoMensalEmCentavos: 0 }),
    ).toEqual([]);
  });

  it('orcamentoMensalEmCentavos: -100 gera um problema com codigo "negativo"', () => {
    const problemas = problemasDeConfiguracoes({
      ...CONFIGURACOES_PADRAO,
      orcamentoMensalEmCentavos: -100,
    });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatchObject({
      campo: 'orcamentoMensalEmCentavos',
      codigo: 'negativo',
    });
  });

  it('três campos inválidos ao mesmo tempo geram três problemas, um por campo', () => {
    const problemas = problemasDeConfiguracoes({
      ...CONFIGURACOES_PADRAO,
      metaSemanalDeFocoEmMinutos: -1,
      metaSemanalDeTreinos: -1,
      orcamentoMensalEmCentavos: -1,
    });
    expect(problemas).toHaveLength(3);
    expect(problemas.map((p) => p.campo).sort()).toEqual(
      ['metaSemanalDeFocoEmMinutos', 'metaSemanalDeTreinos', 'orcamentoMensalEmCentavos'].sort(),
    );
  });

  it('`validarConfiguracoes` continua a devolver as mesmas mensagens de `problemasDeConfiguracoes`', () => {
    const configuracoesInvalidas: Configuracoes = {
      ...CONFIGURACOES_PADRAO,
      metaSemanalDeFocoEmMinutos: -1,
    };
    expect(validarConfiguracoes(configuracoesInvalidas)).toEqual(
      problemasDeConfiguracoes(configuracoesInvalidas).map((p) => p.mensagem),
    );
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
