/**
 * Migração v1 -> v2 (item 1.1 do plano, Fase 1 — Finanças): schema das seis
 * tabelas do pilar, semente das categorias iniciais tanto para quem já tinha
 * o banco em v1 (`upgrade`) quanto para instalação nova (`popular`, ver
 * `Migracao.popular`), e sobrevivência do dado de v1 depois do upgrade.
 *
 * Isolamento (ADR 0005, seção 7): `criarBanco({ indexedDB: new IDBFactory() })`,
 * nome do banco sempre o real `NOME_DO_BANCO` — quem isola é a fábrica nova a
 * cada teste, nunca o nome.
 */
import Dexie from 'dexie';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { criarBanco, NOME_DO_BANCO, TABELAS } from '../db';
import { VERSAO_DO_SCHEMA } from './index';
import { v1Inicial } from './v1-inicial';

let bancoAberto: Dexie | undefined;

afterEach(() => {
  bancoAberto?.close();
  bancoAberto = undefined;
});

/** Um banco que só conhece o schema v1 — simula quem instalou o app antes da Fase 1. */
function criarBancoSoComV1(indexedDB: IDBFactory): Dexie {
  const banco = new Dexie(NOME_DO_BANCO, { indexedDB });
  const versao = banco.version(v1Inicial.versao).stores(v1Inicial.stores);
  if (v1Inicial.upgrade) versao.upgrade(v1Inicial.upgrade);
  return banco;
}

const NOMES_ESPERADOS = ['Alimentação', 'Estudos', 'Lazer', 'Moradia', 'Outros', 'Transporte'];

describe('schema v2 (financas)', () => {
  it('abre com verno 2 e as seis tabelas novas, com os índices exatos declarados em v2-financas.ts', async () => {
    const banco = criarBanco({ indexedDB: new IDBFactory() });
    bancoAberto = banco;
    await banco.open();

    expect(banco.verno).toBe(2);
    expect(banco.verno).toBe(VERSAO_DO_SCHEMA);
    expect(banco.tables.map((tabela) => tabela.name).sort()).toEqual([...TABELAS].sort());

    const indicesEsperadosPorTabela: Record<string, string[]> = {
      categorias: ['nome'],
      lancamentos: ['data', 'categoriaId', 'assinaturaId', 'tipo'],
      assinaturas: ['proximaCobranca'],
      usosDeAssinatura: ['assinaturaId', 'data'],
      cofrinhos: [],
      movimentosDeCofrinho: ['cofrinhoId', 'data'],
    };

    for (const [nomeDaTabela, indicesEsperados] of Object.entries(indicesEsperadosPorTabela)) {
      const tabela = banco.table(nomeDaTabela);
      expect(tabela.schema.primKey.name).toBe('id');
      expect(tabela.schema.indexes.map((indice) => indice.name)).toEqual(indicesEsperados);
    }
  });
});

describe('semente das categorias iniciais', () => {
  it('banco criado do ZERO nasce com as 6 categorias iniciais (via populate, sem upgrade de v1)', async () => {
    const banco = criarBanco({ indexedDB: new IDBFactory() });
    bancoAberto = banco;
    await banco.open();

    const categorias = await banco.table('categorias').toArray();
    expect(categorias).toHaveLength(6);
    expect(categorias.map((categoria: { nome: string }) => categoria.nome).sort()).toEqual(
      NOMES_ESPERADOS,
    );
    for (const categoria of categorias as { id: string; deletedAt: string | null }[]) {
      expect(typeof categoria.id).toBe('string');
      expect(categoria.id.length).toBeGreaterThan(0);
      expect(categoria.deletedAt).toBeNull();
    }
  });

  it('upgrade de um banco v1 EXISTENTE preserva o dado antigo e semeia as categorias (via upgrade)', async () => {
    const fabrica = new IDBFactory();

    const bancoV1 = criarBancoSoComV1(fabrica);
    await bancoV1.open();
    await bancoV1.table('configuracoes').put({
      id: 'configuracoes-unicas',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
      metaSemanalDeFocoEmMinutos: 600,
      metaSemanalDeTreinos: 3,
      orcamentoMensalEmCentavos: null,
      unidadeDePeso: 'kg',
      tema: 'sistema',
      onboardingConcluidoEm: null,
    });
    expect(bancoV1.verno).toBe(1);
    bancoV1.close();

    const bancoV2 = criarBanco({ indexedDB: fabrica });
    bancoAberto = bancoV2;
    await bancoV2.open();

    expect(bancoV2.verno).toBe(2);

    // Dado de v1 sobrevive ao upgrade, intacto.
    const configuracoes = await bancoV2.table('configuracoes').toArray();
    expect(configuracoes).toHaveLength(1);
    expect(configuracoes[0]).toMatchObject({ metaSemanalDeTreinos: 3 });

    // Categorias semeadas pelo `upgrade` da v2 (não `populate`: o banco já existia).
    const categorias = await bancoV2.table('categorias').toArray();
    expect(categorias).toHaveLength(6);
    expect(categorias.map((categoria: { nome: string }) => categoria.nome).sort()).toEqual(
      NOMES_ESPERADOS,
    );
  });

  it('não semeia duas vezes: reabrir um banco v2 já existente mantém 6 categorias', async () => {
    const fabrica = new IDBFactory();

    const primeiraAbertura = criarBanco({ indexedDB: fabrica });
    await primeiraAbertura.open();
    expect(await primeiraAbertura.table('categorias').count()).toBe(6);
    primeiraAbertura.close();

    const segundaAbertura = criarBanco({ indexedDB: fabrica });
    bancoAberto = segundaAbertura;
    await segundaAbertura.open();
    expect(await segundaAbertura.table('categorias').count()).toBe(6);
  });
});
