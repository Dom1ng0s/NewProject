/**
 * `registrarLancamento`/`editarLancamento`/`excluirLancamento`/
 * `listarLancamentosDoMes`/`totaisDeGastosDoMes`/`obterLancamento` (item 1.1
 * do plano): CRUD de lançamentos, soft delete, gravação atômica com o
 * histórico (ADR 0005), e os totais que a regra 7.3 consome.
 *
 * Isolamento (ADR 0005, seção 7): a instância única `db` é limpa no
 * `beforeEach`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db, tabela } from '@/persistencia';
import type { RegistroBase } from '@/persistencia';
import { listarAcoesDoPeriodo } from '@/modulos/nucleo';
import {
  editarLancamento,
  excluirLancamento,
  listarLancamentosDoMes,
  obterLancamento,
  registrarLancamento,
  totaisDeGastosDoMes,
} from './lancamentos';
import type { DadosDeLancamento } from '../dominio/lancamentos';

function lancamento(parcial: Partial<DadosDeLancamento> = {}): DadosDeLancamento {
  return {
    tipo: 'gasto',
    valorCentavos: 1000,
    categoriaId: 'categoria-1',
    descricao: null,
    data: '2026-04-10',
    assinaturaId: null,
    ...parcial,
  };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('registrarLancamento', () => {
  it('grava o lançamento e registra a ação no histórico, na mesma operação', async () => {
    const registrado = await registrarLancamento(lancamento());

    expect(registrado.id).toBeTruthy();
    const acoes = await listarAcoesDoPeriodo('2026-04-01', '2026-04-30');
    expect(acoes).toHaveLength(1);
    expect(acoes[0]?.tipo).toBe('financas.lancamentoRegistrado');
    expect(acoes[0]?.referenciaId).toBe(registrado.id);
    expect(acoes[0]?.dia).toBe('2026-04-10'); // ocorridaEm reflete a data do lançamento, não "agora"
  });

  it('rejeita dados inválidos e não grava nada (nem lançamento, nem ação)', async () => {
    await expect(registrarLancamento(lancamento({ valorCentavos: 0 }))).rejects.toThrow();

    expect(await tabela('lancamentos').count()).toBe(0);
    expect(await tabela('historicoDeAcoes').count()).toBe(0);
  });
});

describe('listarLancamentosDoMes', () => {
  it('só do mês pedido, mais recente primeiro', async () => {
    await registrarLancamento(lancamento({ data: '2026-04-05' }));
    await registrarLancamento(lancamento({ data: '2026-04-20' }));
    await registrarLancamento(lancamento({ data: '2026-05-01' })); // fora do mês
    await registrarLancamento(lancamento({ data: '2026-03-31' })); // fora do mês

    const lancamentos = await listarLancamentosDoMes('2026-04');
    expect(lancamentos.map((l) => l.data)).toEqual(['2026-04-20', '2026-04-05']);
  });

  it('lançamento excluído não aparece na listagem, mas a linha continua na tabela', async () => {
    const registrado = await registrarLancamento(lancamento());
    await excluirLancamento(registrado.id);

    expect(await listarLancamentosDoMes('2026-04')).toEqual([]);
    const registro = await tabela<RegistroBase>('lancamentos').get(registrado.id);
    expect(registro?.deletedAt).not.toBeNull();
  });
});

describe('totaisDeGastosDoMes', () => {
  it('soma só gastos (entradas não entram, regra 7.3), separando "até ontem" e "hoje"', async () => {
    await registrarLancamento(
      lancamento({ tipo: 'gasto', valorCentavos: 1000, data: '2026-04-05' }),
    );
    await registrarLancamento(
      lancamento({ tipo: 'gasto', valorCentavos: 2000, data: '2026-04-10' }),
    );
    await registrarLancamento(
      lancamento({ tipo: 'entrada', valorCentavos: 500000, data: '2026-04-10' }),
    );

    const totais = await totaisDeGastosDoMes('2026-04', '2026-04-10');
    expect(totais.gastosAteOntemEmCentavos).toBe(1000);
    expect(totais.gastosDeHojeEmCentavos).toBe(2000);
  });

  it('mês sem lançamento nenhum soma zero nos dois totais', async () => {
    const totais = await totaisDeGastosDoMes('2026-04', '2026-04-10');
    expect(totais).toEqual({ gastosAteOntemEmCentavos: 0, gastosDeHojeEmCentavos: 0 });
  });
});

describe('editarLancamento', () => {
  it('atualiza os campos informados', async () => {
    const registrado = await registrarLancamento(lancamento({ valorCentavos: 1000 }));
    await editarLancamento(registrado.id, { valorCentavos: 2000, descricao: 'Ajustado' });

    const editado = await obterLancamento(registrado.id);
    expect(editado?.valorCentavos).toBe(2000);
    expect(editado?.descricao).toBe('Ajustado');
    expect(editado?.categoriaId).toBe(registrado.categoriaId); // campos não informados preservados
  });

  it('rejeita mescla inválida e não altera o registro', async () => {
    const registrado = await registrarLancamento(lancamento());
    await expect(editarLancamento(registrado.id, { valorCentavos: -1 })).rejects.toThrow();

    const inalterado = await obterLancamento(registrado.id);
    expect(inalterado?.valorCentavos).toBe(registrado.valorCentavos);
  });

  it('não faz nada para um id inexistente', async () => {
    await expect(
      editarLancamento('id-que-nao-existe', { valorCentavos: 500 }),
    ).resolves.toBeUndefined();
  });
});

describe('obterLancamento', () => {
  it('null para id inexistente ou lançamento excluído', async () => {
    expect(await obterLancamento('id-que-nao-existe')).toBeNull();

    const registrado = await registrarLancamento(lancamento());
    await excluirLancamento(registrado.id);
    expect(await obterLancamento(registrado.id)).toBeNull();
  });
});
