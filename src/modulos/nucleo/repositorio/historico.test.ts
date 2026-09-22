/**
 * `registrarAcao` / `listarAcoesDoPeriodo` / `excluirAcao` (ADR 0005 seção
 * 3.2, 3.4 e 9, item 0.5): CRUD do histórico, soft delete, invariante do
 * prefixo do `tipo`, fuso na derivação de `dia`, e a prova de que soft delete
 * nunca pode ser consultado por índice de `deletedAt`.
 *
 * Isolamento (ADR 0005 seção 7): a instância única `db` é limpa no
 * `beforeEach` — o Vitest isola o módulo por arquivo.
 *
 * Acesso à tabela via `tabela<T>()` (não `db.table()` sem genérico) para
 * manter as asserções tipadas, no mesmo padrão dos repositórios de produção.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataDeCalendarioDe } from '@/compartilhado';
import { db, tabela } from '@/persistencia';
import type { RegistroBase } from '@/persistencia';
import { excluirAcao, listarAcoesDoPeriodo, registrarAcao } from './historico';
import type { AcaoDoHistorico, EntradaDeAcao } from '../dominio/historico';

type RegistroDeAcaoDeProva = AcaoDoHistorico & RegistroBase;

function tabelaDeAcoes() {
  return tabela<RegistroDeAcaoDeProva>('historicoDeAcoes');
}

function acao(parcial: Partial<EntradaDeAcao> = {}): EntradaDeAcao {
  return {
    tipo: 'nucleo.configuracoesSalvas',
    modulo: 'nucleo',
    referenciaId: null,
    quantidade: null,
    ...parcial,
  };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

// `vi.setSystemTime` sem `vi.useFakeTimers()` só troca `Date`/`new Date()`;
// os timers reais (usados pelo fake-indexeddb por trás do Dexie) continuam
// intactos. Usado nos testes que precisam garantir `createdAt`/`updatedAt`
// em milissegundos diferentes de forma determinística, sem depender da
// resolução do relógio real (ver critério 9 e a instabilidade encontrada
// no item 0.5).
afterEach(() => {
  vi.useRealTimers();
});

describe('registrarAcao', () => {
  it('deriva dia de ocorridaEm e grava tipo/modulo informados', async () => {
    await registrarAcao(acao({ ocorridaEm: '2026-03-10T12:00:00.000Z' }));

    const linhas = await tabelaDeAcoes().toArray();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.dia).toBe('2026-03-10');
    expect(linhas[0]?.tipo).toBe('nucleo.configuracoesSalvas');
    expect(linhas[0]?.modulo).toBe('nucleo');
  });

  it('cai para "agora" quando ocorridaEm não é informado, e dia bate com dataDeCalendarioDe(ocorridaEm)', async () => {
    await registrarAcao(acao());
    const [linha] = await tabelaDeAcoes().toArray();
    if (!linha) throw new Error('registro de prova não encontrado');

    expect(typeof linha.ocorridaEm).toBe('string');
    expect(linha.dia).toBe(dataDeCalendarioDe(linha.ocorridaEm));
  });

  it('rejeita tipo cujo prefixo não bate com o modulo informado, e não grava nada (critério 10)', async () => {
    await expect(
      registrarAcao(acao({ tipo: 'nucleo.configuracoesSalvas', modulo: 'treino' })),
    ).rejects.toThrow();

    expect(await tabelaDeAcoes().count()).toBe(0);
  });

  it('fuso: 23h30 em America/Sao_Paulo cai no dia local, não no dia UTC (critério 11)', async () => {
    // 2026-09-21 23:30 em America/Sao_Paulo (UTC-3) == 2026-09-22T02:30:00.000Z
    await registrarAcao(acao({ ocorridaEm: '2026-09-22T02:30:00.000Z' }));

    const [linha] = await tabelaDeAcoes().toArray();
    expect(linha?.dia).toBe('2026-09-21');
  });

  it('dois registros criados em sequência ordenam crescente por id (critério 9)', async () => {
    await registrarAcao(acao());
    await registrarAcao(acao());

    const linhas = await tabelaDeAcoes().toArray();
    const idsEmOrdemDeChegada = linhas.map((linha) => linha.id);
    const idsOrdenados = [...idsEmOrdemDeChegada].sort();

    expect(idsEmOrdemDeChegada).toEqual(idsOrdenados);
  });
});

describe('listarAcoesDoPeriodo + excluirAcao (critério 8)', () => {
  it('lista só as ações do intervalo (dias inclusive), ordenadas por ocorridaEm', async () => {
    await registrarAcao(acao({ ocorridaEm: '2026-03-10T12:00:00.000Z' }));
    await registrarAcao(acao({ ocorridaEm: '2026-03-05T12:00:00.000Z' }));
    await registrarAcao(acao({ ocorridaEm: '2026-04-01T12:00:00.000Z' })); // fora do intervalo
    await registrarAcao(acao({ ocorridaEm: '2026-02-28T12:00:00.000Z' })); // fora do intervalo

    const resultado = await listarAcoesDoPeriodo('2026-03-01', '2026-03-31');

    expect(resultado).toHaveLength(2);
    expect(resultado[0]?.dia).toBe('2026-03-05');
    expect(resultado[1]?.dia).toBe('2026-03-10');
  });

  it('excluirAcao faz a listagem devolver uma a menos, mas a tabela continua com TODAS as linhas', async () => {
    // `ocorridaEm` é um campo de negócio (informado explicitamente acima) e
    // não tem relação com `createdAt`/`updatedAt` (campos de controle, sempre
    // lidos do relógio real em `criarRegistro`/`marcarComoExcluido`). Sem
    // controlar o relógio, criar e excluir em seguida — sem nenhum I/O real
    // entre as duas chamadas, já que o fake-indexeddb resolve rápido — podem
    // cair no mesmo milissegundo e fazer `updatedAt` empatar com `createdAt`.
    // `vi.setSystemTime` sem `vi.useFakeTimers()` mocka só `Date`, não afeta
    // os timers reais do Dexie/fake-indexeddb.
    vi.setSystemTime('2026-03-20T10:00:00.000Z');
    await registrarAcao(acao({ ocorridaEm: '2026-03-05T12:00:00.000Z' }));
    await registrarAcao(acao({ ocorridaEm: '2026-03-10T12:00:00.000Z' }));
    await registrarAcao(acao({ ocorridaEm: '2026-03-15T12:00:00.000Z' }));

    const antes = await listarAcoesDoPeriodo('2026-03-01', '2026-03-31');
    expect(antes).toHaveLength(3);

    const linhas = await tabelaDeAcoes().toArray();
    const alvo = linhas.find((linha) => linha.dia === '2026-03-10');
    if (!alvo) throw new Error('registro de prova não encontrado');

    vi.setSystemTime('2026-03-20T10:00:01.000Z'); // 1s depois: garante updatedAt != createdAt
    await excluirAcao(alvo.id);

    const depois = await listarAcoesDoPeriodo('2026-03-01', '2026-03-31');
    expect(depois).toHaveLength(2);
    expect(depois.some((linha) => linha.dia === '2026-03-10')).toBe(false);

    const todasAsLinhas = await tabelaDeAcoes().toArray();
    expect(todasAsLinhas).toHaveLength(3); // soft delete: a linha nunca é apagada de verdade

    const excluida = todasAsLinhas.find((linha) => linha.id === alvo.id);
    expect(excluida?.deletedAt).not.toBeNull();
    expect(excluida?.updatedAt).not.toBe(alvo.updatedAt);
  });

  it('excluirAcao é idempotente: chamar de novo numa ação já excluída não lança e não muda nada', async () => {
    await registrarAcao(acao({ ocorridaEm: '2026-03-05T12:00:00.000Z' }));
    const [linha] = await tabelaDeAcoes().toArray();
    if (!linha) throw new Error('registro de prova não encontrado');

    await excluirAcao(linha.id);
    const apos1aExclusao = await tabelaDeAcoes().get(linha.id);
    if (!apos1aExclusao) throw new Error('registro de prova não encontrado');

    await excluirAcao(linha.id);
    const apos2aExclusao = await tabelaDeAcoes().get(linha.id);
    if (!apos2aExclusao) throw new Error('registro de prova não encontrado');

    expect(apos2aExclusao.deletedAt).toBe(apos1aExclusao.deletedAt);
    expect(apos2aExclusao.updatedAt).toBe(apos1aExclusao.updatedAt);
  });

  it(
    'prova que db.table("historicoDeAcoes").where("deletedAt").equals(null) NÃO encontra nada ' +
      '(null não é chave válida de IndexedDB; é por isso que listarAcoesDoPeriodo nunca consulta ' +
      'por deletedAt, ADR 0005 seção 3.4 e "fato 2", critério 12)',
    async () => {
      await registrarAcao(acao());
      await registrarAcao(acao());
      const linhas = await tabelaDeAcoes().toArray();
      expect(linhas.length).toBeGreaterThan(0); // há registros ativos de verdade na tabela

      const consultarPorDeletedAt = async () =>
        tabelaDeAcoes()
          .where('deletedAt' as keyof RegistroDeAcaoDeProva)
          .equals(null as unknown as string)
          .toArray();

      // `null` nunca é uma chave válida de IndexedDB (ADR 0005, "fato 2"):
      // mesmo antes de checar se `deletedAt` está indexado, o próprio
      // `equals(null)` já rejeita com "Invalid key provided". Na prática isso
      // significa que uma consulta por `deletedAt === null` (a marca de
      // "ativo") nunca poderia funcionar de qualquer forma — é por isso que o
      // repositório consulta por índice de negócio (`dia`) e filtra os
      // ativos em memória (`apenasAtivos`), nunca por `where('deletedAt')`.
      await expect(consultarPorDeletedAt()).rejects.toThrow(/invalid key/i);
    },
  );
});
