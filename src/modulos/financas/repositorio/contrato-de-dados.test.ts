/**
 * `contratoDeDadosDoFinancas` (mesmo padrão de
 * `src/modulos/nucleo/repositorio/contrato-de-dados.test.ts`, ADR 0006, seção
 * 4.3): as seis tabelas de financas (item 1.1) entram no backup; só
 * `categorias`/`lancamentos` tem CSV nesta entrega; e a conversão de um
 * backup sem a chave "categorias" (pendência 33 do plano — backup de antes
 * do pilar existir) semeia as categorias padrão em vez de deixar o app sem
 * nenhuma.
 *
 * Usa a instância única `db`: tabelas limpas no `beforeEach`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/persistencia';
import { ehErroDeBackup } from '@/modulos/nucleo';
import { NOMES_DE_CATEGORIAS_INICIAIS } from '../dominio/categorias';
import { contratoDeDadosDoFinancas } from './contrato-de-dados';

function tabelaCrua(
  nome:
    | 'categorias'
    | 'lancamentos'
    | 'assinaturas'
    | 'usosDeAssinatura'
    | 'cofrinhos'
    | 'movimentosDeCofrinho',
) {
  return db.table(nome);
}

const BOM = '﻿';
const CRLF = '\r\n';

type RegistroCru = Readonly<Record<string, unknown>>;

function categoriaValida(overrides: RegistroCru = {}): RegistroCru {
  return {
    id: 'categoria-1',
    createdAt: '2026-04-01T12:00:00.000Z',
    updatedAt: '2026-04-01T12:00:00.000Z',
    deletedAt: null,
    nome: 'Alimentação',
    ...overrides,
  };
}

function lancamentoValido(overrides: RegistroCru = {}): RegistroCru {
  return {
    id: 'lancamento-1',
    createdAt: '2026-04-10T12:00:00.000Z',
    updatedAt: '2026-04-10T12:00:00.000Z',
    deletedAt: null,
    tipo: 'gasto',
    valorCentavos: 1000,
    categoriaId: 'categoria-1',
    descricao: null,
    data: '2026-04-10',
    assinaturaId: null,
    ...overrides,
  };
}

async function snapshotDasTabelas() {
  return {
    categorias: await tabelaCrua('categorias').toArray(),
    lancamentos: await tabelaCrua('lancamentos').toArray(),
    assinaturas: await tabelaCrua('assinaturas').toArray(),
    usosDeAssinatura: await tabelaCrua('usosDeAssinatura').toArray(),
    cofrinhos: await tabelaCrua('cofrinhos').toArray(),
    movimentosDeCofrinho: await tabelaCrua('movimentosDeCofrinho').toArray(),
  };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('contratoDeDadosDoFinancas.exportarJson', () => {
  it('as seis tabelas vazias', async () => {
    await expect(contratoDeDadosDoFinancas.exportarJson()).resolves.toEqual({
      categorias: [],
      lancamentos: [],
      assinaturas: [],
      usosDeAssinatura: [],
      cofrinhos: [],
      movimentosDeCofrinho: [],
    });
  });

  it('ordena por id crescente e inclui soft-deleted', async () => {
    await tabelaCrua('categorias').bulkPut([
      categoriaValida({ id: 'c', deletedAt: '2026-04-02T00:00:00.000Z' }),
      categoriaValida({ id: 'a' }),
      categoriaValida({ id: 'b' }),
    ]);

    const dados = await contratoDeDadosDoFinancas.exportarJson();
    const ids = (dados['categorias'] ?? []).map((r) => (r as RegistroCru)['id']);
    expect(ids).toEqual(['a', 'b', 'c']);

    const excluida = (dados['categorias'] ?? []).find((r) => (r as RegistroCru)['id'] === 'c');
    expect((excluida as RegistroCru)['deletedAt']).not.toBeNull();
  });
});

describe('contratoDeDadosDoFinancas.importarJson — validação de negócio', () => {
  it('categoria com nome vazio → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoFinancas.importarJson({ categorias: [categoriaValida({ nome: '' })] }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('lançamento com tipo fora de "gasto"/"entrada" → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoFinancas.importarJson({
        lancamentos: [lancamentoValido({ tipo: 'transferencia' })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('lançamento com valorCentavos <= 0 → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoFinancas.importarJson({
        lancamentos: [lancamentoValido({ valorCentavos: 0 })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('lançamento com data fora do calendário (30 de fevereiro) → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoFinancas.importarJson({
        lancamentos: [lancamentoValido({ data: '2026-02-30' })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  function assinaturaValida(overrides: RegistroCru = {}): RegistroCru {
    return {
      id: 'assinatura-1',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      deletedAt: null,
      nome: 'Streaming',
      valorCentavos: 2990,
      periodicidade: 'mensal',
      proximaCobranca: '2026-05-01',
      diasDeAviso: 3,
      categoriaId: 'categoria-1',
      diaDeCobranca: 1,
      ...overrides,
    };
  }

  it('assinatura com periodicidade fora de "mensal"/"anual" → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoFinancas.importarJson({
        assinaturas: [assinaturaValida({ periodicidade: 'semanal' })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('assinatura sem categoriaId → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoFinancas.importarJson({
        assinaturas: [assinaturaValida({ categoriaId: '' })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('assinatura com diaDeCobranca fora de 1-31 → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoFinancas.importarJson({
        assinaturas: [assinaturaValida({ diaDeCobranca: 32 })],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('assinatura válida é gravada como veio', async () => {
    await contratoDeDadosDoFinancas.importarJson({ assinaturas: [assinaturaValida()] });
    expect(await tabelaCrua('assinaturas').count()).toBe(1);
  });

  it('movimento de cofrinho com valorCentavos 0 → registroInvalido, banco intacto', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoFinancas.importarJson({
        movimentosDeCofrinho: [
          {
            id: 'movimento-1',
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
            deletedAt: null,
            cofrinhoId: 'cofrinho-1',
            valorCentavos: 0,
            data: '2026-04-01',
          },
        ],
      }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });

  it('tabela desconhecida → registroInvalido, nunca ignorada em silêncio', async () => {
    const antes = await snapshotDasTabelas();
    await expect(
      contratoDeDadosDoFinancas.importarJson({ tabelaInventada: [] }),
    ).rejects.toMatchObject({ codigo: 'registroInvalido' });
    expect(await snapshotDasTabelas()).toEqual(antes);
  });
});

describe('contratoDeDadosDoFinancas.importarJson — substituição total', () => {
  it('limpa a tabela quando a chave está ausente (lancamentos), sem mesclar', async () => {
    await tabelaCrua('lancamentos').put(lancamentoValido());
    await contratoDeDadosDoFinancas.importarJson({ categorias: [categoriaValida()] });
    expect(await tabelaCrua('lancamentos').count()).toBe(0);
  });

  it('grava o registro exatamente como veio (nunca regenera id/createdAt/updatedAt)', async () => {
    const categoria = categoriaValida({ updatedAt: '2020-01-01T00:00:00.000Z' });
    await contratoDeDadosDoFinancas.importarJson({ categorias: [categoria] });
    const gravado: unknown = await tabelaCrua('categorias').get('categoria-1');
    expect(gravado).toEqual(categoria);
  });
});

describe('contratoDeDadosDoFinancas.importarJson — conversão de backup antigo (pendência 33)', () => {
  it('arquivo SEM a chave "categorias" (backup de antes do pilar existir) semeia as 6 categorias padrão', async () => {
    await contratoDeDadosDoFinancas.importarJson({ lancamentos: [] });

    const categorias = await tabelaCrua('categorias').toArray();
    expect(categorias).toHaveLength(6);
    expect((categorias as { nome: string }[]).map((c) => c.nome).sort()).toEqual(
      [...NOMES_DE_CATEGORIAS_INICIAIS].sort(),
    );
  });

  it('arquivo COM a chave "categorias" vazia (usuário excluiu todas de propósito) NÃO semeia nada', async () => {
    await contratoDeDadosDoFinancas.importarJson({ categorias: [] });
    expect(await tabelaCrua('categorias').count()).toBe(0);
  });
});

describe('contratoDeDadosDoFinancas.exportarCsv', () => {
  it('nomes exatos: as seis tabelas do pilar (itens 1.1/1.3/1.5)', async () => {
    const arquivos = await contratoDeDadosDoFinancas.exportarCsv();
    expect(arquivos.map((a) => a.nome)).toEqual([
      'financas-categorias.csv',
      'financas-lancamentos.csv',
      'financas-assinaturas.csv',
      'financas-usos-de-assinatura.csv',
      'financas-cofrinhos.csv',
      'financas-movimentos-de-cofrinho.csv',
    ]);
  });

  it('tabelas vazias → só cabeçalho, com BOM/;/CRLF', async () => {
    const [categorias, lancamentos] = await contratoDeDadosDoFinancas.exportarCsv();
    expect(categorias?.conteudo).toBe(`${BOM}id;createdAt;updatedAt;nome${CRLF}`);
    expect(lancamentos?.conteudo).toBe(
      `${BOM}id;createdAt;updatedAt;tipo;valorCentavos;categoriaId;descricao;data;assinaturaId${CRLF}`,
    );
  });

  it('não traz a linha soft-deleted, só a ativa', async () => {
    await tabelaCrua('categorias').bulkPut([
      categoriaValida({ id: 'ativa' }),
      categoriaValida({ id: 'excluida', deletedAt: '2026-04-02T00:00:00.000Z' }),
    ]);

    const [categorias] = await contratoDeDadosDoFinancas.exportarCsv();
    const linhas = (categorias?.conteudo ?? '').split(CRLF).filter(Boolean);
    expect(linhas).toHaveLength(2); // cabeçalho + 1 linha ativa
    expect(linhas[1]).toContain('ativa');
    expect(linhas[1]).not.toContain('excluida');
  });
});

describe('contratoDeDadosDoFinancas.apagarTudo', () => {
  it('clear() físico nas seis tabelas', async () => {
    await tabelaCrua('categorias').put(categoriaValida());
    await tabelaCrua('lancamentos').put(lancamentoValido());

    await contratoDeDadosDoFinancas.apagarTudo();

    const depois = await snapshotDasTabelas();
    expect(depois.categorias).toEqual([]);
    expect(depois.lancamentos).toEqual([]);
  });
});

describe('erro lançado é sempre ErroDeBackup', () => {
  it('ehErroDeBackup reconhece a rejeição de importarJson', async () => {
    try {
      await contratoDeDadosDoFinancas.importarJson({ tabelaInventada: [] });
      throw new Error('deveria ter lançado');
    } catch (erro) {
      expect(ehErroDeBackup(erro)).toBe(true);
    }
  });
});
