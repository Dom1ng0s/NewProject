/**
 * Prova de ambiente (item 0.4/0.5, ADR 0005 seção 7): comprova que
 * `fake-indexeddb` e Dexie funcionam juntos sob Vitest, inclusive
 * `version().upgrade()`, que nenhum teste real exercita até a Fase 1 criar a
 * v2. A tabela `provas` é descartável e NÃO-oficial: o item 0.5 não a importa
 * nem a imita, e o schema de produção vive em `src/persistencia/migracoes/`.
 *
 * Isolamento (pendência 17 fechada, ADR 0005 seção 7): o Dexie resolve a
 * fábrica de IndexedDB no CONSTRUTOR, então trocar `globalThis.indexedDB`
 * depois de construído não isola nada. A saída é passar uma `new
 * IDBFactory()` distinta para cada teste — nunca variar o NOME do banco para
 * simular isolamento (esse era o padrão sorteado por teste que a pendência 17
 * proíbe copiar para os testes do schema real).
 */
import Dexie, { type EntityTable } from 'dexie';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { gerarIdentificador } from '@/compartilhado';

/**
 * Nome fixo e não-sorteado do banco de prova: propositalmente diferente do
 * `NOME_DO_BANCO` real (`app-rotina-db`), porque este arquivo usa um schema
 * (`provas`) que não tem nenhuma relação com o schema de produção.
 */
const NOME_DO_BANCO_DE_PROVA = 'ambiente-de-teste-db';

interface ProvaV1 {
  id: string;
  criadoEm: string;
  valorEmCentavos: number;
}

interface ProvaV2 extends ProvaV1 {
  categoria: string;
}

let dbAberto: Dexie | undefined;

afterEach(() => {
  dbAberto?.close();
  dbAberto = undefined;
});

describe('ambiente de teste: fake-indexeddb + Dexie', () => {
  it('grava e le um registro por chave primaria e por indice', async () => {
    const db = new Dexie(NOME_DO_BANCO_DE_PROVA, { indexedDB: new IDBFactory() }) as Dexie & {
      provas: EntityTable<ProvaV1, 'id'>;
    };
    db.version(1).stores({ provas: 'id, criadoEm' });
    dbAberto = db;

    const registro: ProvaV1 = {
      id: gerarIdentificador(),
      criadoEm: new Date().toISOString(),
      valorEmCentavos: 123456,
    };
    await db.provas.add(registro);

    const porChave = await db.provas.get(registro.id);
    expect(porChave).toEqual(registro);

    const porIndice = await db.provas.where('criadoEm').equals(registro.criadoEm).toArray();
    expect(porIndice).toHaveLength(1);
    expect(porIndice[0]).toEqual(registro);
  });

  it('migra registros da v1 para a v2 com upgrade()', async () => {
    const fabrica = new IDBFactory();

    const dbV1 = new Dexie(NOME_DO_BANCO_DE_PROVA, { indexedDB: fabrica }) as Dexie & {
      provas: EntityTable<ProvaV1, 'id'>;
    };
    dbV1.version(1).stores({ provas: 'id, criadoEm' });
    const registro: ProvaV1 = {
      id: gerarIdentificador(),
      criadoEm: new Date().toISOString(),
      valorEmCentavos: 654321,
    };
    await dbV1.provas.add(registro);
    dbV1.close();

    const dbV2 = new Dexie(NOME_DO_BANCO_DE_PROVA, { indexedDB: fabrica }) as Dexie & {
      provas: EntityTable<ProvaV2, 'id'>;
    };
    dbV2.version(1).stores({ provas: 'id, criadoEm' });
    dbV2
      .version(2)
      .stores({ provas: 'id, criadoEm, categoria' })
      .upgrade(async (transacao) => {
        await transacao
          .table<ProvaV2>('provas')
          .toCollection()
          .modify((antigo) => {
            antigo.categoria = 'sem-categoria';
          });
      });
    dbAberto = dbV2;

    const migrado = await dbV2.provas.get(registro.id);
    expect(migrado).toEqual({ ...registro, categoria: 'sem-categoria' });

    const porIndiceNovo = await dbV2.provas.where('categoria').equals('sem-categoria').toArray();
    expect(porIndiceNovo).toHaveLength(1);
  });
});
