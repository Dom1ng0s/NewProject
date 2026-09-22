/**
 * `criarRegistro`/`atualizarRegistro`/`marcarComoExcluido`/`estaAtivo`/
 * `apenasAtivos` (ADR 0005 seção 2, critérios de aceite 9 e 10 do item 0.5):
 * campos de controle nunca são montados na mão pelos repositórios. Puro, sem
 * banco — não precisa de `fake-indexeddb`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apenasAtivos,
  atualizarRegistro,
  criarRegistro,
  estaAtivo,
  marcarComoExcluido,
} from './tipos';
import type { RegistroBase } from './tipos';

interface EntidadeDeProva extends RegistroBase {
  nome: string;
  valor: number;
}

function criarProva(dados: Partial<Pick<EntidadeDeProva, 'nome' | 'valor'>> = {}): EntidadeDeProva {
  return criarRegistro<EntidadeDeProva>({ nome: dados.nome ?? 'prova', valor: dados.valor ?? 1 });
}

describe('criarRegistro', () => {
  it('gera id no formato UUID v7', () => {
    const registro = criarProva();
    expect(registro.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('createdAt e updatedAt iguais na criação, deletedAt nulo (registro ativo)', () => {
    const registro = criarProva();
    expect(registro.createdAt).toBe(registro.updatedAt);
    expect(registro.deletedAt).toBeNull();
  });

  it('preserva os dados de negócio recebidos', () => {
    const registro = criarProva({ nome: 'estudo', valor: 42 });
    expect(registro.nome).toBe('estudo');
    expect(registro.valor).toBe(42);
  });

  it('dois registros criados em sequência ordenam crescente por id, mesmo no mesmo instante (critério 9)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T10:00:00.000Z'));

    const primeiro = criarProva();
    const segundo = criarProva(); // mesmo instante fake; o contador monotônico do gerador de id decide a ordem

    expect(primeiro.createdAt).toBe(segundo.createdAt);
    expect(primeiro.id < segundo.id).toBe(true);

    vi.useRealTimers();
  });
});

describe('atualizarRegistro', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserva id e createdAt, renova updatedAt e aplica as mudanças (critério 9)', () => {
    vi.setSystemTime(new Date('2026-05-01T10:00:00.000Z'));
    const original = criarProva({ nome: 'a', valor: 1 });

    vi.setSystemTime(new Date('2026-05-01T10:00:00.500Z'));
    const atualizado = atualizarRegistro(original, { valor: 2 });

    expect(atualizado.id).toBe(original.id);
    expect(atualizado.createdAt).toBe(original.createdAt);
    expect(atualizado.updatedAt).not.toBe(original.updatedAt);
    expect(atualizado.valor).toBe(2);
    expect(atualizado.nome).toBe('a');
  });

  it('devolve uma cópia nova, sem mutar o registro original', () => {
    vi.setSystemTime(new Date('2026-05-01T10:00:00.000Z'));
    const original = criarProva({ valor: 1 });
    const originalCongelado = { ...original };

    atualizarRegistro(original, { valor: 99 });

    expect(original).toEqual(originalCongelado);
  });
});

describe('marcarComoExcluido', () => {
  it('preenche deletedAt e updatedAt, mantém id, createdAt e dados de negócio', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T10:00:00.000Z'));
    const original = criarProva({ nome: 'estudo', valor: 7 });

    vi.setSystemTime(new Date('2026-05-01T10:00:00.500Z'));
    const excluido = marcarComoExcluido(original);
    vi.useRealTimers();

    expect(excluido.deletedAt).not.toBeNull();
    expect(excluido.updatedAt).not.toBe(original.updatedAt);
    expect(excluido.id).toBe(original.id);
    expect(excluido.createdAt).toBe(original.createdAt);
    expect(excluido.nome).toBe('estudo');
    expect(excluido.valor).toBe(7);
  });
});

describe('estaAtivo', () => {
  it('verdadeiro quando deletedAt é nulo', () => {
    expect(estaAtivo(criarProva())).toBe(true);
  });

  it('falso quando deletedAt está preenchido', () => {
    expect(estaAtivo(marcarComoExcluido(criarProva()))).toBe(false);
  });
});

describe('apenasAtivos', () => {
  it('filtra os registros excluídos, preservando a ordem dos ativos', () => {
    const a = criarProva({ nome: 'a' });
    const b = marcarComoExcluido(criarProva({ nome: 'b' }));
    const c = criarProva({ nome: 'c' });

    expect(apenasAtivos([a, b, c])).toEqual([a, c]);
  });

  it('lista vazia quando todos estão excluídos', () => {
    const todosExcluidos = [criarProva(), criarProva()].map(marcarComoExcluido);
    expect(apenasAtivos(todosExcluidos)).toEqual([]);
  });
});
