/**
 * `resolverTema` (ADR 0008, seção 6/12, critério de aceite 7). Puro, sem DOM.
 */
import { describe, expect, it } from 'vitest';
import { resolverTema } from './tema';

describe('resolverTema', () => {
  it('tema "claro" resolve para "claro" mesmo com o sistema escuro', () => {
    expect(resolverTema('claro', true)).toBe('claro');
  });

  it('tema "escuro" resolve para "escuro" mesmo com o sistema claro', () => {
    expect(resolverTema('escuro', false)).toBe('escuro');
  });

  it('tema "sistema" com o sistema escuro resolve para "escuro"', () => {
    expect(resolverTema('sistema', true)).toBe('escuro');
  });

  it('tema "sistema" com o sistema claro resolve para "claro"', () => {
    expect(resolverTema('sistema', false)).toBe('claro');
  });
});
