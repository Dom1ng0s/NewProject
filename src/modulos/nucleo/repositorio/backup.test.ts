/**
 * `repositorio/backup.ts` (ADR 0006, seção 4.2): o orquestrador de backup —
 * `exportarBackup`, `exportarCsvPorModulo`, `importarBackup`, `apagarTudo`.
 * Cobre os critérios de aceite 4, 5, 6, 7, 8, 9, 14 e 15 do ADR.
 *
 * `treino`, `estudos` e `financas` ainda não têm tabela própria (Fases 1/2/4):
 * em vez de importar aqueles módulos (a fronteira de import do ESLint proíbe
 * `src/modulos/nucleo/**` de importar qualquer pilar, inclusive em teste),
 * este arquivo usa contratos FAKE locais que espelham o comportamento real
 * dos stubs (`src/modulos/{treino,estudos,financas}/index.ts`): resolvem
 * vazio, e rejeitam se a importação trouxer alguma chave de tabela para eles.
 *
 * Usa a instância única `db` (padrão do item 0.5): tabelas limpas no
 * `beforeEach`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db, TABELAS, VERSAO_DO_SCHEMA } from '@/persistencia';
import type { NomeDeTabela } from '@/persistencia';
import {
  ErroDeBackup,
  FORMATO_DO_BACKUP,
  montarBackup,
  resumirBackup,
  serializarBackup,
} from '../dominio/backup';
import type { ArquivoDeBackup } from '../dominio/backup';
import type { ContratoDeDadosDeModulo, IdDeModulo } from '../tipos';
import { registrarAcao, excluirAcao } from './historico';
import { obterConfiguracoes, salvarConfiguracoes } from './configuracoes';
import { CONFIGURACOES_PADRAO } from '../dominio/configuracoes';
import { contratoDeDadosDoNucleo } from './contrato-de-dados';
import { apagarTudo, exportarBackup, exportarCsvPorModulo, importarBackup } from './backup';

/** Espelha o stub real dos pilares sem tabela (seção 5.4 do ADR): vazio ao
 * exportar, rejeita qualquer chave de tabela ao importar. */
function contratoDePilarVazio(modulo: IdDeModulo): ContratoDeDadosDeModulo {
  return {
    modulo,
    exportarJson: () => Promise.resolve({}),
    importarJson: (dados) => {
      if (Object.keys(dados).length > 0) {
        throw new ErroDeBackup(
          'registroInvalido',
          `Modulo "${modulo}" ainda nao possui tabelas (fake de teste).`,
        );
      }
      return Promise.resolve();
    },
    exportarCsv: () => Promise.resolve([]),
    apagarTudo: () => Promise.resolve(),
  };
}

const contratoTreino = contratoDePilarVazio('treino');
const contratoEstudos = contratoDePilarVazio('estudos');
const contratoFinancas = contratoDePilarVazio('financas');

const contratos: readonly ContratoDeDadosDeModulo[] = [
  contratoDeDadosDoNucleo,
  contratoTreino,
  contratoEstudos,
  contratoFinancas,
];

/**
 * Acesso cru às tabelas via `db.table` (não o `tabela<T>()` tipado da
 * produção — aqui os registros são montados à mão como objetos literais
 * "crus", e o fallback genérico de `tabela<T>()` sem tipo explícito
 * rejeitaria campos que `RegistroBase` não conhece). Mesmo padrão de
 * `transacao.test.ts` e `contrato-de-dados.test.ts`.
 */
function tabelaCrua(nome: NomeDeTabela) {
  return db.table(nome);
}

function normalizarParaComparar(arquivo: ArquivoDeBackup): string {
  return serializarBackup({
    ...arquivo,
    metadados: { ...arquivo.metadados, geradoEm: 'DATA-FIXA-PARA-COMPARACAO' },
  });
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

/** Semeia 1 configuração + 3 ações (uma delas soft-deleted). */
async function semearNucleo(): Promise<void> {
  await salvarConfiguracoes({ metaSemanalDeTreinos: 4 });
  await registrarAcao({
    tipo: 'nucleo.configuracoesSalvas',
    modulo: 'nucleo',
    referenciaId: null,
    quantidade: null,
  });
  const idParaExcluir = 'acao-a-excluir';
  await tabelaCrua('historicoDeAcoes').put({
    id: idParaExcluir,
    createdAt: '2026-09-22T10:00:00.000Z',
    updatedAt: '2026-09-22T10:00:00.000Z',
    deletedAt: null,
    tipo: 'nucleo.configuracoesSalvas',
    modulo: 'nucleo',
    ocorridaEm: '2026-09-22T10:00:00.000Z',
    dia: '2026-09-22',
    referenciaId: null,
    quantidade: null,
  });
  await excluirAcao(idParaExcluir);
}

describe('exportarBackup', () => {
  it('critério 4: metadados corretos e todas as ações (inclusive soft-deleted); pilares vazios como {}', async () => {
    await semearNucleo();

    const arquivo = await exportarBackup(contratos);

    expect(arquivo.metadados.formato).toBe(FORMATO_DO_BACKUP);
    expect(arquivo.metadados.versaoDoFormato).toBe(1);
    expect(arquivo.metadados.versaoDoSchema).toBe(VERSAO_DO_SCHEMA);
    expect(arquivo.metadados.geradoEm).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const historico = arquivo.modulos.nucleo?.['historicoDeAcoes'] ?? [];
    expect(historico).toHaveLength(3); // 1 do salvarConfiguracoes + 1 manual + 1 (a mesma) excluída
    const algumaExcluida = historico.some(
      (r) => (r as { deletedAt: string | null }).deletedAt !== null,
    );
    expect(algumaExcluida).toBe(true);

    expect(arquivo.modulos.nucleo?.['configuracoes']).toHaveLength(1);
    expect(arquivo.modulos.treino).toEqual({});
    expect(arquivo.modulos.estudos).toEqual({});
    expect(arquivo.modulos.financas).toEqual({});
  });

  it('critério 5: metadados sem rastro de identificação — só as quatro chaves', async () => {
    const arquivo = await exportarBackup(contratos);
    expect(Object.keys(arquivo.metadados).sort()).toEqual(
      ['formato', 'geradoEm', 'versaoDoFormato', 'versaoDoSchema'].sort(),
    );
  });

  it('critério 6: determinismo — duas exportações do mesmo banco são idênticas exceto geradoEm', async () => {
    await semearNucleo();

    const arquivo1 = await exportarBackup(contratos);
    const arquivo2 = await exportarBackup(contratos);

    expect(normalizarParaComparar(arquivo1)).toBe(normalizarParaComparar(arquivo2));
  });

  it('critério 6: cada tabela sai ordenada por id crescente', async () => {
    await tabelaCrua('historicoDeAcoes').bulkPut([
      {
        id: 'zzz',
        createdAt: '2026-09-22T10:00:00.000Z',
        updatedAt: '2026-09-22T10:00:00.000Z',
        deletedAt: null,
        tipo: 'nucleo.configuracoesSalvas',
        modulo: 'nucleo',
        ocorridaEm: '2026-09-22T10:00:00.000Z',
        dia: '2026-09-22',
        referenciaId: null,
        quantidade: null,
      },
      {
        id: 'aaa',
        createdAt: '2026-09-22T10:00:00.000Z',
        updatedAt: '2026-09-22T10:00:00.000Z',
        deletedAt: null,
        tipo: 'nucleo.configuracoesSalvas',
        modulo: 'nucleo',
        ocorridaEm: '2026-09-22T10:00:00.000Z',
        dia: '2026-09-22',
        referenciaId: null,
        quantidade: null,
      },
      {
        id: 'mmm',
        createdAt: '2026-09-22T10:00:00.000Z',
        updatedAt: '2026-09-22T10:00:00.000Z',
        deletedAt: null,
        tipo: 'nucleo.configuracoesSalvas',
        modulo: 'nucleo',
        ocorridaEm: '2026-09-22T10:00:00.000Z',
        dia: '2026-09-22',
        referenciaId: null,
        quantidade: null,
      },
    ]);

    const arquivo = await exportarBackup(contratos);
    const ids = (arquivo.modulos.nucleo?.['historicoDeAcoes'] ?? []).map(
      (r) => (r as { id: string }).id,
    );
    expect(ids).toEqual(['aaa', 'mmm', 'zzz']);
  });
});

describe('exportarCsvPorModulo', () => {
  it('critério 15 (nível orquestrador): dois arquivos para o núcleo, lista vazia para os três pilares', async () => {
    const resultado = await exportarCsvPorModulo(contratos);

    const doNucleo = resultado.find((r) => r.modulo === 'nucleo');
    expect(doNucleo?.arquivos.map((a) => a.nome).sort()).toEqual(
      ['nucleo-configuracoes.csv', 'nucleo-historico-de-acoes.csv'].sort(),
    );

    for (const modulo of ['treino', 'estudos', 'financas'] as const) {
      expect(resultado.find((r) => r.modulo === modulo)?.arquivos).toEqual([]);
    }
  });
});

describe('importarBackup', () => {
  it('critério 7: ida e volta fiel (exportar → apagarTudo → importar → exportar === original, exceto geradoEm) e nenhuma ação de histórico é criada', async () => {
    await semearNucleo();

    const antes = await exportarBackup(contratos);
    const quantidadeDeAcoesAntes = antes.modulos.nucleo?.['historicoDeAcoes']?.length ?? 0;

    await apagarTudo(contratos);
    const resultado = await importarBackup(contratos, antes);

    const depois = await exportarBackup(contratos);

    expect(normalizarParaComparar(depois)).toBe(normalizarParaComparar(antes));
    expect(depois.modulos.nucleo?.['historicoDeAcoes']).toHaveLength(quantidadeDeAcoesAntes);
    expect(resultado.registrosImportados).toBe(resumirBackup(antes).registros);
  });

  it('critério 8a: substituição, não mesclagem — banco com 5 ações + importar arquivo com 2 resulta em exatamente 2', async () => {
    for (let i = 0; i < 5; i += 1) {
      await registrarAcao({
        tipo: 'nucleo.configuracoesSalvas',
        modulo: 'nucleo',
        referenciaId: null,
        quantidade: null,
      });
    }
    expect(await tabelaCrua('historicoDeAcoes').count()).toBe(5);

    const acao = (id: string) => ({
      id,
      createdAt: '2026-09-22T10:00:00.000Z',
      updatedAt: '2026-09-22T10:00:00.000Z',
      deletedAt: null,
      tipo: 'nucleo.configuracoesSalvas',
      modulo: 'nucleo',
      ocorridaEm: '2026-09-22T10:00:00.000Z',
      dia: '2026-09-22',
      referenciaId: null,
      quantidade: null,
    });
    const arquivoComDuasAcoes = montarBackup({
      geradoEm: '2026-09-22T12:00:00.000Z',
      versaoDoSchema: VERSAO_DO_SCHEMA,
      modulos: { nucleo: { historicoDeAcoes: [acao('acao-1'), acao('acao-2')] } },
    });

    await importarBackup(contratos, arquivoComDuasAcoes);

    expect(await tabelaCrua('historicoDeAcoes').count()).toBe(2);
  });

  it('critério 8b: importar arquivo cujo modulos.nucleo não traz a chave "configuracoes" deixa a tabela vazia', async () => {
    await salvarConfiguracoes({ metaSemanalDeTreinos: 5 });
    expect(await tabelaCrua('configuracoes').count()).toBe(1);

    const arquivoSemConfiguracoes = montarBackup({
      geradoEm: '2026-09-22T12:00:00.000Z',
      versaoDoSchema: VERSAO_DO_SCHEMA,
      modulos: { nucleo: { historicoDeAcoes: [] } },
    });

    await importarBackup(contratos, arquivoSemConfiguracoes);

    expect(await tabelaCrua('configuracoes').count()).toBe(0);
  });

  it('critério 9: atomicidade — contrato falso que lança em importarJson faz importarBackup rejeitar com TODAS as tabelas intactas', async () => {
    await semearNucleo();
    const antes = {
      configuracoes: await tabelaCrua('configuracoes').toArray(),
      historicoDeAcoes: await tabelaCrua('historicoDeAcoes').toArray(),
    };

    const contratoQuebrado: ContratoDeDadosDeModulo = {
      modulo: 'treino',
      exportarJson: () => Promise.resolve({}),
      importarJson: () => {
        throw new Error('falha proposital de teste (atomicidade)');
      },
      exportarCsv: () => Promise.resolve([]),
      apagarTudo: () => Promise.resolve(),
    };
    const contratosComQuebrado: readonly ContratoDeDadosDeModulo[] = [
      contratoDeDadosDoNucleo,
      contratoQuebrado,
      contratoEstudos,
      contratoFinancas,
    ];

    // Dados BEM diferentes do que já está no banco, para provar que o
    // rollback desfaz de verdade (e não coincide por acaso com o estado atual).
    const arquivoComDadosDiferentes = montarBackup({
      geradoEm: '2026-09-22T12:00:00.000Z',
      versaoDoSchema: VERSAO_DO_SCHEMA,
      modulos: {
        nucleo: {
          historicoDeAcoes: [
            {
              id: 'acao-que-nunca-deveria-entrar',
              createdAt: '2026-09-22T12:00:00.000Z',
              updatedAt: '2026-09-22T12:00:00.000Z',
              deletedAt: null,
              tipo: 'nucleo.configuracoesSalvas',
              modulo: 'nucleo',
              ocorridaEm: '2026-09-22T12:00:00.000Z',
              dia: '2026-09-22',
              referenciaId: null,
              quantidade: null,
            },
          ],
        },
      },
    });

    await expect(importarBackup(contratosComQuebrado, arquivoComDadosDiferentes)).rejects.toThrow(
      'falha proposital de teste (atomicidade)',
    );

    const depois = {
      configuracoes: await tabelaCrua('configuracoes').toArray(),
      historicoDeAcoes: await tabelaCrua('historicoDeAcoes').toArray(),
    };
    expect(depois.configuracoes).toEqual(antes.configuracoes);
    expect(depois.historicoDeAcoes).toEqual(antes.historicoDeAcoes);
  });
});

describe('apagarTudo', () => {
  it('critério 14: todas as tabelas com count() === 0, obterConfiguracoes() no padrão, db.verno inalterado, nenhuma linha nova em histórico', async () => {
    await semearNucleo();
    const vernoAntes = db.verno;

    await apagarTudo(contratos);

    for (const nomeDeTabela of TABELAS) {
      expect(await tabelaCrua(nomeDeTabela).count()).toBe(0);
    }
    expect(await obterConfiguracoes()).toEqual(CONFIGURACOES_PADRAO);
    expect(db.verno).toBe(vernoAntes);
  });
});
