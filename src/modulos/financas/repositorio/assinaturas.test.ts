/**
 * `criarAssinatura`/`editarAssinatura`/`excluirAssinatura`/`registrarUsoHoje`/
 * `contarUsosNoMes`/`processarCobrancasAutomaticas` (item 1.3 do plano): CRUD
 * com o dia âncora derivado, "usei hoje" sem duplicar, e a cobrança
 * automática gerando lançamento + avançando a data, de forma idempotente.
 *
 * Isolamento (ADR 0005, seção 7): a instância única `db` é limpa no
 * `beforeEach`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db, tabela } from '@/persistencia';
import type { RegistroBase } from '@/persistencia';
import { listarAcoesDoPeriodo } from '@/modulos/nucleo';
import {
  contarUsosNoMes,
  criarAssinatura,
  editarAssinatura,
  excluirAssinatura,
  listarAssinaturas,
  obterAssinatura,
  processarCobrancasAutomaticas,
  registrarUsoHoje,
} from './assinaturas';
import type { DadosDeFormularioDeAssinatura } from './assinaturas';
import { listarLancamentosDoMes } from './lancamentos';

function formulario(
  parcial: Partial<DadosDeFormularioDeAssinatura> = {},
): DadosDeFormularioDeAssinatura {
  return {
    nome: 'Streaming',
    valorCentavos: 2990,
    periodicidade: 'mensal',
    proximaCobranca: '2026-04-10',
    diasDeAviso: 3,
    categoriaId: 'categoria-1',
    ...parcial,
  };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('criarAssinatura', () => {
  it('deriva diaDeCobranca do dia de proximaCobranca', async () => {
    const criada = await criarAssinatura(formulario({ proximaCobranca: '2026-01-31' }));
    expect(criada.diaDeCobranca).toBe(31);
  });

  it('rejeita dados inválidos e não grava nada', async () => {
    await expect(criarAssinatura(formulario({ valorCentavos: 0 }))).rejects.toThrow();
    expect(await tabela('assinaturas').count()).toBe(0);
  });
});

describe('editarAssinatura', () => {
  it('recalcula diaDeCobranca quando proximaCobranca muda', async () => {
    const criada = await criarAssinatura(formulario({ proximaCobranca: '2026-04-10' }));
    await editarAssinatura(criada.id, { proximaCobranca: '2026-05-20' });

    const editada = await obterAssinatura(criada.id);
    expect(editada?.proximaCobranca).toBe('2026-05-20');
    expect(editada?.diaDeCobranca).toBe(20);
  });

  it('preserva diaDeCobranca quando outros campos mudam', async () => {
    const criada = await criarAssinatura(formulario({ proximaCobranca: '2026-04-10' }));
    await editarAssinatura(criada.id, { valorCentavos: 3500 });

    const editada = await obterAssinatura(criada.id);
    expect(editada?.valorCentavos).toBe(3500);
    expect(editada?.diaDeCobranca).toBe(10);
  });

  it('rejeita mescla inválida e não altera o registro', async () => {
    const criada = await criarAssinatura(formulario());
    await expect(editarAssinatura(criada.id, { valorCentavos: -1 })).rejects.toThrow();
    const inalterada = await obterAssinatura(criada.id);
    expect(inalterada?.valorCentavos).toBe(criada.valorCentavos);
  });
});

describe('excluirAssinatura', () => {
  it('soft delete: some da listagem, linha continua na tabela', async () => {
    const criada = await criarAssinatura(formulario());
    await excluirAssinatura(criada.id);

    expect(await listarAssinaturas()).toEqual([]);
    const registro = await tabela<RegistroBase>('assinaturas').get(criada.id);
    expect(registro?.deletedAt).not.toBeNull();
  });
});

describe('registrarUsoHoje — "usei hoje" (item 1.3)', () => {
  it('registra um uso no dia', async () => {
    const criada = await criarAssinatura(formulario());
    await registrarUsoHoje(criada.id, '2026-04-10');

    expect(await contarUsosNoMes(criada.id, '2026-04')).toBe(1);
  });

  it('tocar de novo no mesmo dia não duplica', async () => {
    const criada = await criarAssinatura(formulario());
    await registrarUsoHoje(criada.id, '2026-04-10');
    await registrarUsoHoje(criada.id, '2026-04-10');

    expect(await contarUsosNoMes(criada.id, '2026-04')).toBe(1);
  });

  it('dias diferentes contam separadamente', async () => {
    const criada = await criarAssinatura(formulario());
    await registrarUsoHoje(criada.id, '2026-04-10');
    await registrarUsoHoje(criada.id, '2026-04-11');

    expect(await contarUsosNoMes(criada.id, '2026-04')).toBe(2);
  });
});

describe('processarCobrancasAutomaticas — item 1.3 (ESPECIFICACAO §6.2, critério de aceite)', () => {
  it('sem assinatura vencida: não gera lançamento', async () => {
    await criarAssinatura(formulario({ proximaCobranca: '2026-05-01' }));
    await processarCobrancasAutomaticas('2026-04-10');

    expect(await listarLancamentosDoMes('2026-04')).toEqual([]);
  });

  it('gera o lançamento na categoria da assinatura e avança proximaCobranca', async () => {
    const criada = await criarAssinatura(
      formulario({ proximaCobranca: '2026-04-10', categoriaId: 'categoria-assinatura' }),
    );
    await processarCobrancasAutomaticas('2026-04-15');

    const lancamentos = await listarLancamentosDoMes('2026-04');
    expect(lancamentos).toHaveLength(1);
    expect(lancamentos[0]).toMatchObject({
      tipo: 'gasto',
      valorCentavos: 2990,
      categoriaId: 'categoria-assinatura',
      assinaturaId: criada.id,
      data: '2026-04-10',
    });

    const atualizada = await obterAssinatura(criada.id);
    expect(atualizada?.proximaCobranca).toBe('2026-05-10');

    const acoes = await listarAcoesDoPeriodo('2026-04-01', '2026-04-30');
    expect(acoes.some((a) => a.tipo === 'financas.lancamentoRegistrado')).toBe(true);
  });

  it('várias cobranças atrasadas geram um lançamento por data (pendência 4 do plano)', async () => {
    await criarAssinatura(formulario({ proximaCobranca: '2026-01-10' }));
    await processarCobrancasAutomaticas('2026-04-20');

    const janeiro = await listarLancamentosDoMes('2026-01');
    const fevereiro = await listarLancamentosDoMes('2026-02');
    const marco = await listarLancamentosDoMes('2026-03');
    const abril = await listarLancamentosDoMes('2026-04');
    expect(janeiro).toHaveLength(1);
    expect(fevereiro).toHaveLength(1);
    expect(marco).toHaveLength(1);
    expect(abril).toHaveLength(1);
  });

  it('idempotente: rodar duas vezes na mesma data não duplica lançamento', async () => {
    await criarAssinatura(formulario({ proximaCobranca: '2026-04-10' }));
    await processarCobrancasAutomaticas('2026-04-15');
    await processarCobrancasAutomaticas('2026-04-15');

    expect(await listarLancamentosDoMes('2026-04')).toHaveLength(1);
  });

  it('assinatura excluída não gera cobrança', async () => {
    const criada = await criarAssinatura(formulario({ proximaCobranca: '2026-04-10' }));
    await excluirAssinatura(criada.id);
    await processarCobrancasAutomaticas('2026-04-15');

    expect(await listarLancamentosDoMes('2026-04')).toEqual([]);
  });
});
