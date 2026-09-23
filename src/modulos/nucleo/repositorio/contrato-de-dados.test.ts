/**
 * `repositorio/contrato-de-dados.ts` (ADR 0006, seção 4.3): o núcleo como
 * módulo do backup. Testa `contratoDeDadosDoNucleo` diretamente (fora da
 * transação do orquestrador — `importarJson` valida ANTES de fazer
 * `clear()`, então dá para testar "banco intacto após rejeição" mesmo sem a
 * transação de `repositorio/backup.ts`). Cobre os critérios de aceite 11, 12,
 * 13 e 15 do ADR.
 *
 * Usa a instância única `db` (padrão do item 0.5): tabelas limpas no
 * `beforeEach`, mesmo critério de `transacao.test.ts`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/persistencia';
import { ErroDeBackup, ehErroDeBackup } from '../dominio/backup';
import { ID_DAS_CONFIGURACOES } from './configuracoes';
import { contratoDeDadosDoNucleo } from './contrato-de-dados';

/**
 * Acesso cru às tabelas via `db.table` (não o `tabela<T>()` tipado da
 * produção): aqui os registros são montados à mão, inclusive com valores
 * deliberadamente inválidos para os testes de rejeição, então não fazem
 * sentido tipados como `RegistroBase`. Mesmo padrão de `transacao.test.ts`.
 */
function tabelaCrua(nome: 'configuracoes' | 'historicoDeAcoes') {
  return db.table(nome);
}

const BOM = '﻿';
const CRLF = '\r\n';

type RegistroCru = Readonly<Record<string, unknown>>;

function configuracaoValida(overrides: RegistroCru = {}): RegistroCru {
  return {
    id: ID_DAS_CONFIGURACOES,
    createdAt: '2026-09-22T17:00:00.000Z',
    updatedAt: '2026-09-22T17:00:00.000Z',
    deletedAt: null,
    metaSemanalDeFocoEmMinutos: 600,
    metaSemanalDeTreinos: 3,
    orcamentoMensalEmCentavos: null,
    unidadeDePeso: 'kg',
    tema: 'sistema',
    onboardingConcluidoEm: null,
    ...overrides,
  };
}

function acaoValida(overrides: RegistroCru = {}): RegistroCru {
  return {
    id: 'acao-1',
    createdAt: '2026-09-22T17:00:00.000Z',
    updatedAt: '2026-09-22T17:00:00.000Z',
    deletedAt: null,
    tipo: 'nucleo.configuracoesSalvas',
    modulo: 'nucleo',
    ocorridaEm: '2026-09-22T17:00:00.000Z',
    dia: '2026-09-22',
    referenciaId: null,
    quantidade: null,
    ...overrides,
  };
}

async function snapshotDasTabelas() {
  return {
    configuracoes: await tabelaCrua('configuracoes').toArray(),
    historicoDeAcoes: await tabelaCrua('historicoDeAcoes').toArray(),
  };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('contratoDeDadosDoNucleo.exportarJson', () => {
  it('tabelas vazias → { configuracoes: [], historicoDeAcoes: [] }', async () => {
    await expect(contratoDeDadosDoNucleo.exportarJson()).resolves.toEqual({
      configuracoes: [],
      historicoDeAcoes: [],
    });
  });

  it('ordena historicoDeAcoes por id crescente e inclui soft-deleted (critério 4/6)', async () => {
    await tabelaCrua('historicoDeAcoes').bulkPut([
      acaoValida({ id: 'c', deletedAt: '2026-09-22T18:00:00.000Z' }),
      acaoValida({ id: 'a' }),
      acaoValida({ id: 'b' }),
    ]);

    const dados = await contratoDeDadosDoNucleo.exportarJson();
    const ids = (dados['historicoDeAcoes'] ?? []).map((r) => (r as RegistroCru)['id']);
    expect(ids).toEqual(['a', 'b', 'c']);

    const excluida = (dados['historicoDeAcoes'] ?? []).find(
      (r) => (r as RegistroCru)['id'] === 'c',
    );
    expect((excluida as RegistroCru)['deletedAt']).not.toBeNull();
  });

  it('configuracoes tem no máximo 1 linha, ausência de linha vira lista vazia (não erro)', async () => {
    const dados = await contratoDeDadosDoNucleo.exportarJson();
    expect(dados['configuracoes']).toEqual([]);

    await tabelaCrua('configuracoes').put(configuracaoValida());
    const dadosComLinha = await contratoDeDadosDoNucleo.exportarJson();
    expect(dadosComLinha['configuracoes']).toHaveLength(1);
  });
});

describe('contratoDeDadosDoNucleo.importarJson — validação de negócio (critério 11)', () => {
  it('duas linhas em configuracoes → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoNucleo.importarJson({
        configuracoes: [configuracaoValida({ id: ID_DAS_CONFIGURACOES }), configuracaoValida()],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('id diferente do sentinela "configuracoes-unicas" → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoNucleo.importarJson({
        configuracoes: [configuracaoValida({ id: 'outro-id' })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('metaSemanalDeTreinos: -1 → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoNucleo.importarJson({
        configuracoes: [configuracaoValida({ metaSemanalDeTreinos: -1 })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('tema: "roxo" (fora da união) → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoNucleo.importarJson({
        configuracoes: [configuracaoValida({ tema: 'roxo' })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('unidadeDePeso fora da união ("g") → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoNucleo.importarJson({
        configuracoes: [configuracaoValida({ unidadeDePeso: 'g' })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('ação com tipo "financas.x" e modulo "nucleo" (prefixo não bate) → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoNucleo.importarJson({
        historicoDeAcoes: [acaoValida({ tipo: 'financas.x', modulo: 'nucleo' })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('modulo desconhecido em historicoDeAcoes ("saude") → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoNucleo.importarJson({
        historicoDeAcoes: [acaoValida({ tipo: 'saude.x', modulo: 'saude' })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('quantidade fracionária (não inteira nem null) → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoNucleo.importarJson({
        historicoDeAcoes: [acaoValida({ quantidade: 1.5 })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('dia fora do formato AAAA-MM-DD → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoNucleo.importarJson({
        historicoDeAcoes: [acaoValida({ dia: '22/09/2026' })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('onboardingConcluidoEm: "sim" (nem null, nem instante ISO) → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoNucleo.importarJson({
        configuracoes: [configuracaoValida({ onboardingConcluidoEm: 'sim' })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('onboardingConcluidoEm ausente → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    const { onboardingConcluidoEm, ...semOnboarding } = configuracaoValida();
    void onboardingConcluidoEm;
    await expect(
      contratoDeDadosDoNucleo.importarJson({
        configuracoes: [semOnboarding],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('tipo: "nucleo" sem ponto (modulo: "nucleo") → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoNucleo.importarJson({
        historicoDeAcoes: [acaoValida({ tipo: 'nucleo', modulo: 'nucleo' })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('tipo: "nucleo." (ponto sem nada depois, modulo: "nucleo") → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoNucleo.importarJson({
        historicoDeAcoes: [acaoValida({ tipo: 'nucleo.', modulo: 'nucleo' })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });
});

describe('contratoDeDadosDoNucleo.importarJson — tabela desconhecida (critério 13)', () => {
  it('modulos.nucleo.tabelaInventada → registroInvalido, nunca ignorada em silêncio', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoNucleo.importarJson({ tabelaInventada: [] }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });
});

describe('contratoDeDadosDoNucleo.importarJson — tipo desconhecido é aceito (critério 12)', () => {
  it('tipo fora de TipoDeAcao ("treino.serieRegistrada") com modulo compatível importa e sobrevive à exportação', async () => {
    const acaoDeOutroModulo = acaoValida({
      id: 'acao-de-treino',
      tipo: 'treino.serieRegistrada',
      modulo: 'treino',
    });

    await contratoDeDadosDoNucleo.importarJson({ historicoDeAcoes: [acaoDeOutroModulo] });

    const dados = await contratoDeDadosDoNucleo.exportarJson();
    expect(dados['historicoDeAcoes']).toEqual([acaoDeOutroModulo]);
  });
});

describe('contratoDeDadosDoNucleo.importarJson — substituição total', () => {
  it('limpa a tabela quando a chave está ausente do argumento (não mescla)', async () => {
    await tabelaCrua('configuracoes').put(configuracaoValida());
    await contratoDeDadosDoNucleo.importarJson({ historicoDeAcoes: [] });
    expect(await tabelaCrua('configuracoes').count()).toBe(0);
  });

  it('grava o registro exatamente como veio (nunca regenera id/createdAt/updatedAt)', async () => {
    const config = configuracaoValida({ updatedAt: '2020-01-01T00:00:00.000Z' });
    await contratoDeDadosDoNucleo.importarJson({ configuracoes: [config] });
    const gravado: unknown = await tabelaCrua('configuracoes').get(ID_DAS_CONFIGURACOES);
    expect(gravado).toEqual(config);
  });
});

describe('contratoDeDadosDoNucleo.exportarCsv (critério 15, nível de módulo)', () => {
  it('nomes exatos: nucleo-configuracoes.csv e nucleo-historico-de-acoes.csv', async () => {
    const arquivos = await contratoDeDadosDoNucleo.exportarCsv();
    expect(arquivos.map((a) => a.nome)).toEqual([
      'nucleo-configuracoes.csv',
      'nucleo-historico-de-acoes.csv',
    ]);
  });

  it('tabelas vazias → só cabeçalho, com BOM/;/CRLF', async () => {
    const [configuracoes, historico] = await contratoDeDadosDoNucleo.exportarCsv();
    expect(configuracoes?.conteudo).toBe(
      `${BOM}id;createdAt;updatedAt;metaSemanalDeFocoEmMinutos;metaSemanalDeTreinos;orcamentoMensalEmCentavos;unidadeDePeso;tema;onboardingConcluidoEm${CRLF}`,
    );
    expect(historico?.conteudo).toBe(
      `${BOM}id;createdAt;ocorridaEm;dia;modulo;tipo;quantidade;referenciaId${CRLF}`,
    );
  });

  it('não traz a linha soft-deleted, só a ativa (critério 15)', async () => {
    await tabelaCrua('historicoDeAcoes').bulkPut([
      acaoValida({ id: 'ativa' }),
      acaoValida({ id: 'excluida', deletedAt: '2026-09-22T20:00:00.000Z' }),
    ]);

    const [, historico] = await contratoDeDadosDoNucleo.exportarCsv();
    const linhas = (historico?.conteudo ?? '').split(CRLF).filter(Boolean);
    // BOM + cabeçalho + 1 linha de dados (só a ativa)
    expect(linhas).toHaveLength(2);
    expect(linhas[1]).toContain('ativa');
    expect(linhas[1]).not.toContain('excluida');
  });
});

describe('contratoDeDadosDoNucleo.apagarTudo', () => {
  it('clear() físico nas duas tabelas do núcleo', async () => {
    await tabelaCrua('configuracoes').put(configuracaoValida());
    await tabelaCrua('historicoDeAcoes').put(acaoValida());

    await contratoDeDadosDoNucleo.apagarTudo();

    expect(await tabelaCrua('configuracoes').count()).toBe(0);
    expect(await tabelaCrua('historicoDeAcoes').count()).toBe(0);
  });
});

describe('erro lançado é sempre ErroDeBackup', () => {
  it('ehErroDeBackup reconhece a rejeição de importarJson', async () => {
    try {
      await contratoDeDadosDoNucleo.importarJson({ tabelaInventada: [] });
      throw new Error('deveria ter lançado');
    } catch (erro) {
      expect(ehErroDeBackup(erro)).toBe(true);
      expect(erro).toBeInstanceOf(ErroDeBackup);
    }
  });
});
