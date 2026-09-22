/**
 * Gravação atômica (ADR 0005 seção 5 e 9, critério 5): commit grava nas duas
 * tabelas; erro dentro da operação desfaz as DUAS gravações.
 *
 * `emTransacao` opera sobre a instância única `db` (não recebe banco por
 * parâmetro — é o contrato da produção), então o isolamento aqui segue o
 * padrão de "Repositórios" da ADR 0005 seção 7: o Vitest isola o módulo por
 * arquivo, e as tabelas são limpas no `beforeEach` para isolar dentro do
 * arquivo entre os dois testes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { emTransacao } from './transacao';

beforeEach(async () => {
  await Promise.all(db.tables.map((tabela) => tabela.clear()));
});

describe('emTransacao', () => {
  it('grava nas duas tabelas quando a operação termina sem erro', async () => {
    await emTransacao(['configuracoes', 'historicoDeAcoes'], async () => {
      await db.table('configuracoes').put({ id: 'configuracao-de-prova', valor: 1 });
      await db.table('historicoDeAcoes').put({ id: 'acao-de-prova', valor: 2 });
    });

    expect(await db.table('configuracoes').count()).toBe(1);
    expect(await db.table('historicoDeAcoes').count()).toBe(1);
  });

  it('não grava em NENHUMA tabela quando a operação lança um erro proposital (rollback, critério 5)', async () => {
    await expect(
      emTransacao(['configuracoes', 'historicoDeAcoes'], async () => {
        await db.table('configuracoes').put({ id: 'configuracao-de-prova', valor: 1 });
        await db.table('historicoDeAcoes').put({ id: 'acao-de-prova', valor: 2 });
        throw new Error('erro proposital para forçar o rollback');
      }),
    ).rejects.toThrow('erro proposital para forçar o rollback');

    expect(await db.table('configuracoes').count()).toBe(0);
    expect(await db.table('historicoDeAcoes').count()).toBe(0);
  });
});
