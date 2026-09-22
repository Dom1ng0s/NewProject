/**
 * Prova de ambiente (item 0.4, ADR 0004 secao 3): comprova que `fake-indexeddb`
 * e Dexie funcionam juntos sob Vitest, antes do schema real (item 0.5) existir.
 * A tabela `provas` e descartavel e NAO-oficial: o item 0.5 nao deve importa-la
 * nem imita-la, e o schema de producao vive em outro arquivo.
 */
import Dexie, { type EntityTable } from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { gerarIdentificador } from '@/compartilhado';

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
    const nomeDoBanco = `prova-${gerarIdentificador()}`;
    const db = new Dexie(nomeDoBanco) as Dexie & {
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
    const nomeDoBanco = `prova-${gerarIdentificador()}`;

    const dbV1 = new Dexie(nomeDoBanco) as Dexie & {
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

    const dbV2 = new Dexie(nomeDoBanco) as Dexie & {
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
