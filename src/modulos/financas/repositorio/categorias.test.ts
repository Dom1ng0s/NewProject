/**
 * `criarCategoria`/`renomearCategoria`/`excluirCategoria`/`listarCategorias`/
 * `listarCategoriasPorUso` (item 1.1 do plano): CRUD de categorias e a
 * ordenação "mais usadas primeiro" que o gasto em 3 toques depende.
 *
 * Isolamento (ADR 0005, seção 7): a instância única `db` é limpa no
 * `beforeEach` — o Vitest isola o módulo por arquivo.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { gerarIdentificador } from '@/compartilhado';
import { db, tabela } from '@/persistencia';
import type { RegistroBase } from '@/persistencia';
import {
  criarCategoria,
  excluirCategoria,
  listarCategorias,
  listarCategoriasPorUso,
  renomearCategoria,
} from './categorias';

interface RegistroDeLancamentoDeProva extends RegistroBase {
  categoriaId: string;
}

function tabelaDeLancamentos() {
  return tabela<RegistroDeLancamentoDeProva>('lancamentos');
}

async function gravarLancamentoDeProva(categoriaId: string): Promise<void> {
  const agora = new Date().toISOString();
  await tabelaDeLancamentos().put({
    id: gerarIdentificador(),
    createdAt: agora,
    updatedAt: agora,
    deletedAt: null,
    categoriaId,
  });
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('criarCategoria', () => {
  it('cria e devolve a categoria com id', async () => {
    const categoria = await criarCategoria('Lazer');
    expect(categoria.nome).toBe('Lazer');
    expect(typeof categoria.id).toBe('string');
    expect(categoria.id.length).toBeGreaterThan(0);
  });

  it('rejeita nome vazio e não grava nada', async () => {
    await expect(criarCategoria('   ')).rejects.toThrow();
    expect(await listarCategorias()).toEqual([]);
  });

  it('remove espaços nas pontas ao gravar', async () => {
    const categoria = await criarCategoria('  Viagem  ');
    expect(categoria.nome).toBe('Viagem');
  });
});

describe('listarCategorias', () => {
  it('só ativas, em ordem alfabética (pt-BR)', async () => {
    await criarCategoria('Transporte');
    await criarCategoria('Alimentação');
    const categorias = await listarCategorias();
    expect(categorias.map((c) => c.nome)).toEqual(['Alimentação', 'Transporte']);
  });

  it('categoria excluída não aparece na listagem', async () => {
    const categoria = await criarCategoria('Lazer');
    await excluirCategoria(categoria.id);
    expect(await listarCategorias()).toEqual([]);
  });
});

describe('renomearCategoria', () => {
  it('atualiza o nome', async () => {
    const categoria = await criarCategoria('Lazer');
    await renomearCategoria(categoria.id, 'Entretenimento');
    const [encontrada] = await listarCategorias();
    expect(encontrada?.nome).toBe('Entretenimento');
  });

  it('rejeita nome inválido e não altera nada', async () => {
    const categoria = await criarCategoria('Lazer');
    await expect(renomearCategoria(categoria.id, '')).rejects.toThrow();
    const [encontrada] = await listarCategorias();
    expect(encontrada?.nome).toBe('Lazer');
  });

  it('não faz nada para um id inexistente (não lança)', async () => {
    await expect(renomearCategoria('id-que-nao-existe', 'Novo nome')).resolves.toBeUndefined();
  });
});

describe('excluirCategoria', () => {
  it('soft delete: some da listagem, mas a linha continua na tabela', async () => {
    const categoria = await criarCategoria('Lazer');
    await excluirCategoria(categoria.id);

    expect(await listarCategorias()).toEqual([]);
    const registro = await tabela('categorias').get(categoria.id);
    expect(registro).toBeTruthy();
    expect((registro as { deletedAt: string | null }).deletedAt).not.toBeNull();
  });

  it('é idempotente: excluir de novo não lança', async () => {
    const categoria = await criarCategoria('Lazer');
    await excluirCategoria(categoria.id);
    await expect(excluirCategoria(categoria.id)).resolves.toBeUndefined();
  });
});

describe('listarCategoriasPorUso', () => {
  it('ordena pela contagem de lançamentos ativos, mais usada primeiro; empate por nome', async () => {
    const alimentacao = await criarCategoria('Alimentação');
    const transporte = await criarCategoria('Transporte');
    await criarCategoria('Lazer'); // sem uso nenhum

    await gravarLancamentoDeProva(transporte.id);
    await gravarLancamentoDeProva(transporte.id);
    await gravarLancamentoDeProva(alimentacao.id);

    const ordenadas = await listarCategoriasPorUso();
    expect(ordenadas.map((c) => c.nome)).toEqual(['Transporte', 'Alimentação', 'Lazer']);
  });

  it('sem nenhum lançamento, cai para ordem alfabética', async () => {
    await criarCategoria('Transporte');
    await criarCategoria('Alimentação');
    const ordenadas = await listarCategoriasPorUso();
    expect(ordenadas.map((c) => c.nome)).toEqual(['Alimentação', 'Transporte']);
  });
});
