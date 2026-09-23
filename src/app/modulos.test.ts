/**
 * `contratosDeDados` REAIS do app (`src/app/modulos.ts`), não contratos fake
 * que só espelham o comportamento dos stubs de treino/estudos/financas
 * (`src/modulos/nucleo/repositorio/backup.test.ts`). Cobre a segunda metade
 * do critério 13 do ADR 0006 (tabela desconhecida de um PILAR real faz
 * `importarBackup` rejeitar) e reaproveita a mesma massa de dados para
 * provar os critérios 4, 7 e 14 com a lista de contratos que `rotas.tsx`
 * de fato passa para a tela `Dados`.
 *
 * `src/app/**` não pode importar `@/persistencia` nem `dexie` (regra
 * `semBanco` do `eslint.config.js`, que vale também para `*.test.ts` dentro
 * de `src/app/**`): "banco intacto" aqui é sempre verificado através dos
 * próprios contratos (`exportarBackup`/`apagarTudo`), nunca lendo `db`
 * diretamente.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  apagarTudo,
  exportarBackup,
  FORMATO_DO_BACKUP,
  importarBackup,
  registrarAcao,
  salvarConfiguracoes,
  VERSAO_DO_FORMATO_DE_BACKUP,
  VERSAO_DO_SCHEMA,
} from '@/modulos/nucleo';
import type { ArquivoDeBackup } from '@/modulos/nucleo';
import { atalhosDeRegistro, cartoesDaHoje, contratosDeDados } from './modulos';

function semGeradoEm(arquivo: ArquivoDeBackup): unknown {
  return { ...arquivo, metadados: { ...arquivo.metadados, geradoEm: 'IGNORADO' } };
}

/** Semeia 1 configuração + 1 ação no núcleo, únicos módulos com tabela hoje. */
async function semearNucleo(): Promise<void> {
  await salvarConfiguracoes({ metaSemanalDeTreinos: 4 });
  await registrarAcao({
    tipo: 'nucleo.configuracoesSalvas',
    modulo: 'nucleo',
    referenciaId: null,
    quantidade: null,
  });
}

beforeEach(async () => {
  await apagarTudo(contratosDeDados);
});

describe('contratosDeDados reais do app (ADR 0006, critérios 4/7/13/14)', () => {
  it('critério 13 (segunda metade): modulos.treino.series faz importarBackup rejeitar, com todas as tabelas intactas', async () => {
    await semearNucleo();
    const antes = await exportarBackup(contratosDeDados);

    const arquivoComTabelaDesconhecidaDeTreino: ArquivoDeBackup = {
      metadados: {
        formato: FORMATO_DO_BACKUP,
        versaoDoFormato: VERSAO_DO_FORMATO_DE_BACKUP,
        versaoDoSchema: VERSAO_DO_SCHEMA,
        geradoEm: '2026-09-22T12:00:00.000Z',
      },
      modulos: { treino: { series: [{ id: 'nunca-deveria-entrar' }] } },
    };

    await expect(
      importarBackup(contratosDeDados, arquivoComTabelaDesconhecidaDeTreino),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });

    const depois = await exportarBackup(contratosDeDados);
    expect(semGeradoEm(depois)).toEqual(semGeradoEm(antes));
  });

  it('critério 7: ida e volta fiel (exportar → apagarTudo → importar → exportar) usando a lista real de contratosDeDados', async () => {
    await semearNucleo();

    const antes = await exportarBackup(contratosDeDados);
    await apagarTudo(contratosDeDados);
    const resultado = await importarBackup(contratosDeDados, antes);
    const depois = await exportarBackup(contratosDeDados);

    expect(semGeradoEm(depois)).toEqual(semGeradoEm(antes));
    expect(resultado.registrosImportados).toBeGreaterThan(0);
  });

  it('critério 4/14: exportarBackup traz {} para os três pilares reais e apagarTudo os mantém vazios', async () => {
    await semearNucleo();

    const arquivo = await exportarBackup(contratosDeDados);
    expect(arquivo.modulos.treino).toEqual({});
    expect(arquivo.modulos.estudos).toEqual({});
    expect(arquivo.modulos.financas).toEqual({});

    await apagarTudo(contratosDeDados);
    const depoisDeApagar = await exportarBackup(contratosDeDados);
    expect(depoisDeApagar.modulos.nucleo?.['configuracoes']).toEqual([]);
    expect(depoisDeApagar.modulos.nucleo?.['historicoDeAcoes']).toEqual([]);
  });
});

describe('cartoesDaHoje e atalhosDeRegistro (ADR 0009, critério 5)', () => {
  it('cartoesDaHoje tem 4 itens, um por IdDeModulo, com `ordem` únicas e `titulo` não vazio', () => {
    expect(cartoesDaHoje).toHaveLength(4);

    const modulos = cartoesDaHoje.map((cartao) => cartao.modulo);
    expect(new Set(modulos).size).toBe(4);
    expect(new Set(modulos)).toEqual(new Set(['nucleo', 'treino', 'estudos', 'financas']));

    const ordens = cartoesDaHoje.map((cartao) => cartao.ordem);
    expect(new Set(ordens).size).toBe(4);

    for (const cartao of cartoesDaHoje) {
      expect(typeof cartao.titulo).toBe('string');
      expect(cartao.titulo.trim().length).toBeGreaterThan(0);
      expect(typeof cartao.Componente).toBe('function');
    }
  });

  it('ordenados por `ordem`, os módulos saem financas, estudos, treino, nucleo', () => {
    const ordenados = [...cartoesDaHoje].sort((a, b) => a.ordem - b.ordem);
    expect(ordenados.map((cartao) => cartao.modulo)).toEqual([
      'financas',
      'estudos',
      'treino',
      'nucleo',
    ]);
  });

  it('atalhosDeRegistro é [] nesta fase (o primeiro atalho real chega no item 1.10)', () => {
    expect(atalhosDeRegistro).toEqual([]);
  });
});
