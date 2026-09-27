/**
 * `criarCofrinho`/`editarCofrinho`/`excluirCofrinho`/
 * `registrarMovimentoDeCofrinho`/`listarMovimentosDoCofrinho` (item 1.5 do
 * plano): CRUD de cofrinhos, soft delete, e depósitos/retiradas.
 *
 * Isolamento (ADR 0005, seção 7): a instância única `db` é limpa no
 * `beforeEach`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db, tabela } from '@/persistencia';
import type { RegistroBase } from '@/persistencia';
import {
  criarCofrinho,
  editarCofrinho,
  excluirCofrinho,
  listarCofrinhos,
  listarMovimentosDoCofrinho,
  obterCofrinho,
  registrarMovimentoDeCofrinho,
} from './cofrinhos';
import type { DadosDeFormularioDeCofrinho } from './cofrinhos';

function formulario(
  parcial: Partial<DadosDeFormularioDeCofrinho> = {},
): DadosDeFormularioDeCofrinho {
  return {
    nome: 'Viagem',
    alvoCentavos: 500000,
    prazo: null,
    ...parcial,
  };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('criarCofrinho', () => {
  it('grava com criadoEm = hoje (parâmetro)', async () => {
    const criado = await criarCofrinho(formulario(), '2026-04-10');
    expect(criado.criadoEm).toBe('2026-04-10');
  });

  it('rejeita dados inválidos e não grava nada', async () => {
    await expect(criarCofrinho(formulario({ alvoCentavos: 0 }), '2026-04-10')).rejects.toThrow();
    expect(await tabela('cofrinhos').count()).toBe(0);
  });
});

describe('editarCofrinho', () => {
  it('atualiza os campos informados', async () => {
    const criado = await criarCofrinho(formulario({ alvoCentavos: 100000 }), '2026-04-10');
    await editarCofrinho(criado.id, { alvoCentavos: 200000 });

    const editado = await obterCofrinho(criado.id);
    expect(editado?.alvoCentavos).toBe(200000);
    expect(editado?.nome).toBe(criado.nome); // campos não informados preservados
  });

  it('rejeita mescla inválida e não altera o registro', async () => {
    const criado = await criarCofrinho(formulario(), '2026-04-10');
    await expect(editarCofrinho(criado.id, { alvoCentavos: -1 })).rejects.toThrow();

    const inalterado = await obterCofrinho(criado.id);
    expect(inalterado?.alvoCentavos).toBe(criado.alvoCentavos);
  });

  it('não faz nada para um id inexistente', async () => {
    await expect(
      editarCofrinho('id-que-nao-existe', { alvoCentavos: 500 }),
    ).resolves.toBeUndefined();
  });
});

describe('excluirCofrinho', () => {
  it('soft delete: some da listagem, linha continua na tabela', async () => {
    const criado = await criarCofrinho(formulario(), '2026-04-10');
    await excluirCofrinho(criado.id);

    expect(await listarCofrinhos()).toEqual([]);
    const registro = await tabela<RegistroBase>('cofrinhos').get(criado.id);
    expect(registro?.deletedAt).not.toBeNull();
  });
});

describe('registrarMovimentoDeCofrinho', () => {
  it('grava depósito (positivo) e retirada (negativo)', async () => {
    const criado = await criarCofrinho(formulario(), '2026-04-10');
    await registrarMovimentoDeCofrinho(criado.id, 1000, '2026-04-11');
    await registrarMovimentoDeCofrinho(criado.id, -200, '2026-04-12');

    const movimentos = await listarMovimentosDoCofrinho(criado.id);
    expect(movimentos.map((m) => m.valorCentavos)).toEqual([-200, 1000]); // mais recente primeiro
  });

  it('rejeita valor zero e não grava nada', async () => {
    const criado = await criarCofrinho(formulario(), '2026-04-10');
    await expect(
      registrarMovimentoDeCofrinho(criado.id, 0, '2026-04-11'),
    ).rejects.toThrow();
    expect(await listarMovimentosDoCofrinho(criado.id)).toEqual([]);
  });

  it('lança para um cofrinho inexistente', async () => {
    await expect(
      registrarMovimentoDeCofrinho('id-que-nao-existe', 1000, '2026-04-11'),
    ).rejects.toThrow();
  });

  it('lança para um cofrinho já excluído', async () => {
    const criado = await criarCofrinho(formulario(), '2026-04-10');
    await excluirCofrinho(criado.id);
    await expect(
      registrarMovimentoDeCofrinho(criado.id, 1000, '2026-04-11'),
    ).rejects.toThrow();
  });
});
