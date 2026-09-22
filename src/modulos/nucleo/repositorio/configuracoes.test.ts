/**
 * `obterConfiguracoes` / `salvarConfiguracoes` (ADR 0005 seção 6 e 9, item
 * 0.5): leitura sem gravar, gravação na linha sentinela única, mescla, e
 * atomicidade real com o histórico (`registrarAcao` aninhado).
 *
 * Isolamento (ADR 0005 seção 7): a instância única `db` é limpa no
 * `beforeEach` — o Vitest isola o módulo por arquivo.
 *
 * Acesso à tabela via `tabela<T>()` (não `db.table()` sem genérico) para
 * manter as asserções tipadas, no mesmo padrão dos repositórios de produção.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db, tabela } from '@/persistencia';
import type { RegistroBase } from '@/persistencia';
import { CONFIGURACOES_PADRAO } from '../dominio/configuracoes';
import type { Configuracoes } from '../dominio/configuracoes';
import type { AcaoDoHistorico } from '../dominio/historico';
import { ID_DAS_CONFIGURACOES, obterConfiguracoes, salvarConfiguracoes } from './configuracoes';

type RegistroDeConfiguracoesDeProva = Configuracoes & RegistroBase;
type RegistroDeAcaoDeProva = AcaoDoHistorico & RegistroBase;

function tabelaDeConfiguracoes() {
  return tabela<RegistroDeConfiguracoesDeProva>('configuracoes');
}

function tabelaDeAcoes() {
  return tabela<RegistroDeAcaoDeProva>('historicoDeAcoes');
}

function esperarMs(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('obterConfiguracoes', () => {
  it('sem linha no banco devolve CONFIGURACOES_PADRAO, sem gravar nada (critério 7)', async () => {
    const configuracoes = await obterConfiguracoes();

    expect(configuracoes).toEqual(CONFIGURACOES_PADRAO);
    expect(await tabelaDeConfiguracoes().count()).toBe(0);
  });
});

describe('salvarConfiguracoes', () => {
  it('entrada inválida rejeita e NÃO grava configuração nem ação do histórico (critério 6)', async () => {
    await expect(salvarConfiguracoes({ metaSemanalDeTreinos: -1 })).rejects.toThrow();

    expect(await tabelaDeConfiguracoes().count()).toBe(0);
    expect(await tabelaDeAcoes().count()).toBe(0);
  });

  it('entrada válida grava UMA configuração e UMA ação do histórico, na mesma transação (critério 6)', async () => {
    const salvo = await salvarConfiguracoes({ tema: 'escuro' });

    expect(salvo).toEqual({ ...CONFIGURACOES_PADRAO, tema: 'escuro' });
    expect(await tabelaDeConfiguracoes().count()).toBe(1);
    expect(await tabelaDeAcoes().count()).toBe(1);

    const acoes = await tabelaDeAcoes().toArray();
    expect(acoes[0]?.tipo).toBe('nucleo.configuracoesSalvas');
    expect(acoes[0]?.modulo).toBe('nucleo');
  });

  it('mescla a mudança sobre o padrão na primeira gravação, preservando os demais campos', async () => {
    await salvarConfiguracoes({ metaSemanalDeTreinos: 5 });
    const configuracoes = await obterConfiguracoes();

    expect(configuracoes).toEqual({ ...CONFIGURACOES_PADRAO, metaSemanalDeTreinos: 5 });
  });

  it('mescla sobre o que já existe em gravações seguintes, sem perder o que não mudou', async () => {
    await salvarConfiguracoes({ metaSemanalDeTreinos: 5 });
    await salvarConfiguracoes({ tema: 'claro' });
    const configuracoes = await obterConfiguracoes();

    expect(configuracoes).toEqual({
      ...CONFIGURACOES_PADRAO,
      metaSemanalDeTreinos: 5,
      tema: 'claro',
    });
  });

  it('sempre grava na linha ID_DAS_CONFIGURACOES: duas gravações seguidas nunca passam de 1 linha (critério 10)', async () => {
    await salvarConfiguracoes({ tema: 'claro' });
    await salvarConfiguracoes({ tema: 'escuro' });

    const linhas = await tabelaDeConfiguracoes().toArray();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.id).toBe(ID_DAS_CONFIGURACOES);
  });

  it('createdAt não muda numa atualização; updatedAt muda (critério 9)', async () => {
    await salvarConfiguracoes({ tema: 'claro' });
    const primeiraLinha = await tabelaDeConfiguracoes().get(ID_DAS_CONFIGURACOES);
    if (!primeiraLinha) throw new Error('registro de prova não encontrado');

    await esperarMs(5); // garante instantes distintos sem usar fake timers (Dexie real por trás)
    await salvarConfiguracoes({ tema: 'escuro' });
    const segundaLinha = await tabelaDeConfiguracoes().get(ID_DAS_CONFIGURACOES);
    if (!segundaLinha) throw new Error('registro de prova não encontrado');

    expect(segundaLinha.createdAt).toBe(primeiraLinha.createdAt);
    expect(segundaLinha.updatedAt).not.toBe(primeiraLinha.updatedAt);
  });

  it('reprova entrada inválida numa segunda gravação sem alterar a configuração já gravada (atomicidade)', async () => {
    await salvarConfiguracoes({ tema: 'claro' });

    await expect(salvarConfiguracoes({ metaSemanalDeTreinos: -1 })).rejects.toThrow();

    expect(await obterConfiguracoes()).toEqual({ ...CONFIGURACOES_PADRAO, tema: 'claro' });
    expect(await tabelaDeAcoes().count()).toBe(1); // só a ação da 1ª gravação válida
  });
});
