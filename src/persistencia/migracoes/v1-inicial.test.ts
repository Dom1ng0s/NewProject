/**
 * Schema v1 e critérios estáticos do ADR 0005 seção 9 (item 0.5).
 *
 * Isolamento (ADR 0005 seção 7, pendência 17 fechada): `criarBanco({
 * indexedDB: new IDBFactory() })`, nome do banco sempre o real `NOME_DO_BANCO`
 * — quem isola é a fábrica nova a cada teste, nunca o nome.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { criarBanco, NOME_DO_BANCO, TABELAS } from '../db';
import { MIGRACOES, VERSAO_DO_SCHEMA } from './index';
import * as persistencia from '../index';

let bancoAberto: ReturnType<typeof criarBanco> | undefined;

afterEach(() => {
  bancoAberto?.close();
  bancoAberto = undefined;
});

describe('schema v1 (critério 3)', () => {
  it('abre com verno 1, nome real, e as tabelas e índices exatos', async () => {
    const banco = criarBanco({ indexedDB: new IDBFactory() });
    bancoAberto = banco;
    await banco.open();

    expect(banco.name).toBe(NOME_DO_BANCO);
    expect(banco.verno).toBe(1);
    expect(banco.verno).toBe(VERSAO_DO_SCHEMA);

    expect(banco.tables.map((tabela) => tabela.name).sort()).toEqual([...TABELAS].sort());

    const configuracoes = banco.table('configuracoes');
    expect(configuracoes.schema.primKey.name).toBe('id');
    expect(configuracoes.schema.indexes.map((indice) => indice.name)).toEqual([]);

    const historicoDeAcoes = banco.table('historicoDeAcoes');
    expect(historicoDeAcoes.schema.primKey.name).toBe('id');
    // Ordem exatamente como declarada em v1-inicial.ts, não apenas "contém".
    expect(historicoDeAcoes.schema.indexes.map((indice) => indice.name)).toEqual([
      'dia',
      'tipo',
      'modulo',
    ]);
  });
});

interface RegistroDeProva {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  valor?: number;
}

describe('sobrevive a fechar e reabrir (critério 4)', () => {
  it('grava, fecha, abre outra instância na MESMA fábrica e o registro continua idêntico', async () => {
    const fabrica = new IDBFactory();
    const registroDeProva: RegistroDeProva = {
      id: 'registro-de-prova',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
      valor: 42,
    };

    const primeiraInstancia = criarBanco({ indexedDB: fabrica });
    await primeiraInstancia.table<RegistroDeProva, string>('configuracoes').put(registroDeProva);
    primeiraInstancia.close();

    const segundaInstancia = criarBanco({ indexedDB: fabrica });
    bancoAberto = segundaInstancia;
    const lido = await segundaInstancia
      .table<RegistroDeProva, string>('configuracoes')
      .get('registro-de-prova');

    expect(lido).toEqual(registroDeProva);
  });

  it('uma fábrica NOVA não enxerga o registro da fábrica anterior (prova de que o isolamento é real)', async () => {
    const primeiraFabrica = new IDBFactory();
    const primeiraInstancia = criarBanco({ indexedDB: primeiraFabrica });
    await primeiraInstancia.table<RegistroDeProva, string>('configuracoes').put({
      id: 'registro-de-prova',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    });
    primeiraInstancia.close();

    const segundaFabrica = new IDBFactory();
    const instanciaIsolada = criarBanco({ indexedDB: segundaFabrica });
    bancoAberto = instanciaIsolada;

    expect(await instanciaIsolada.table<RegistroDeProva, string>('configuracoes').count()).toBe(0);
  });
});

describe('critérios estáticos do ADR 0005 seção 9', () => {
  const raizDoSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

  async function listarArquivosDeFonte(dir: string): Promise<string[]> {
    const entradas = await readdir(dir, { withFileTypes: true });
    const grupos = await Promise.all(
      entradas.map(async (entrada): Promise<string[]> => {
        const caminho = path.join(dir, entrada.name);
        if (entrada.isDirectory()) return listarArquivosDeFonte(caminho);

        const ehFonteTs = /\.(ts|tsx)$/.test(entrada.name);
        const ehTeste = entrada.name.endsWith('.test.ts') || entrada.name.endsWith('.test.tsx');
        return ehFonteTs && !ehTeste ? [caminho] : [];
      }),
    );
    return grupos.flat();
  }

  /** Remove comentários de bloco e de linha antes de procurar por padrões de código real. */
  function removerComentarios(codigo: string): string {
    return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  }

  it('persistencia/index.ts exporta exatamente o combinado da seção 1 do ADR (critério 2)', () => {
    const exportado = Object.keys(persistencia).sort();
    const esperado = [
      'db',
      'criarBanco',
      'tabela',
      'TABELAS',
      'NOME_DO_BANCO',
      'VERSAO_DO_SCHEMA',
      'emTransacao',
      'criarRegistro',
      'atualizarRegistro',
      'marcarComoExcluido',
      'estaAtivo',
      'apenasAtivos',
      'solicitarArmazenamentoPersistente',
    ].sort();

    expect(exportado).toEqual(esperado);
  });

  it('nenhum arquivo fora de */repositorio/** ou persistencia/** importa @/persistencia (critério 2)', async () => {
    const arquivos = await listarArquivosDeFonte(raizDoSrc);
    const ofensores: string[] = [];

    for (const arquivo of arquivos) {
      const relativo = path.relative(raizDoSrc, arquivo).split(path.sep).join('/');
      const dentroDoRepositorio = relativo.includes('/repositorio/');
      const dentroDaPersistencia = relativo.startsWith('persistencia/');
      if (dentroDoRepositorio || dentroDaPersistencia) continue;

      const conteudo = await readFile(arquivo, 'utf-8');
      if (conteudo.includes('@/persistencia')) ofensores.push(relativo);
    }

    expect(ofensores).toEqual([]);
  });

  it('nenhuma migração indexa deletedAt em `stores` (critério 12, metade "dentro de stores")', () => {
    for (const migracao of MIGRACOES) {
      for (const definicao of Object.values(migracao.stores)) {
        if (definicao === null) continue;
        expect(definicao).not.toMatch(/deletedAt/);
      }
    }
  });

  it('nenhum arquivo de código consulta where("deletedAt") (critério 12, metade "where")', async () => {
    const arquivos = await listarArquivosDeFonte(raizDoSrc);
    const ofensores: string[] = [];

    for (const arquivo of arquivos) {
      const conteudo = removerComentarios(await readFile(arquivo, 'utf-8'));
      if (/\.where\(\s*['"]deletedAt['"]\s*\)/.test(conteudo)) {
        ofensores.push(path.relative(raizDoSrc, arquivo));
      }
    }

    expect(ofensores).toEqual([]);
  });
});
