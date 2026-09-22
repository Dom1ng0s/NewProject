/**
 * `dataDeCalendarioDe` no limite do fuso (critério 11 do item 0.5): 23h30
 * local em `America/Sao_Paulo` não pode cair no dia seguinte por causa do
 * fuso UTC. `TZ=America/Sao_Paulo` é fixado em `vitest.config.ts`.
 *
 * Instantes explícitos como parâmetro, sem `vi.useFakeTimers()`, para não
 * depender do dia em que a suíte roda (função pura recebe o instante, não lê
 * o relógio).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agoraEmIso, dataDeCalendarioDe, hojeEmDataDeCalendario } from './datas';

describe('dataDeCalendarioDe', () => {
  it('23h30 em America/Sao_Paulo (UTC-3) fica no dia local, não no dia UTC (critério 11)', () => {
    // 2026-09-21 23:30:00 em America/Sao_Paulo == 2026-09-22T02:30:00.000Z
    expect(dataDeCalendarioDe('2026-09-22T02:30:00.000Z')).toBe('2026-09-21');
  });

  it('vira o ano civil quando o instante UTC já é do dia/ano seguinte', () => {
    // 2026-01-01T01:00:00Z == 2025-12-31 22:00 em America/Sao_Paulo
    expect(dataDeCalendarioDe('2026-01-01T01:00:00.000Z')).toBe('2025-12-31');
  });

  it('meio-dia local não tem ambiguidade de fuso', () => {
    // 2026-06-15T15:00:00Z == 2026-06-15 12:00 em America/Sao_Paulo
    expect(dataDeCalendarioDe('2026-06-15T15:00:00.000Z')).toBe('2026-06-15');
  });

  it('início do dia local (00:00) também não cruza o dia UTC anterior', () => {
    // 2026-03-02T03:00:00Z == 2026-03-02 00:00 em America/Sao_Paulo
    expect(dataDeCalendarioDe('2026-03-02T03:00:00.000Z')).toBe('2026-03-02');
  });

  it('lança em vez de devolver "NaN-NaN-NaN" silencioso para um instante inválido', () => {
    expect(() => dataDeCalendarioDe('não é uma data')).toThrow(/instante ISO inválido/);
  });

  it('lança para string vazia', () => {
    expect(() => dataDeCalendarioDe('')).toThrow(/instante ISO inválido/);
  });

  it('lança para uma data de calendário sem componente de hora, em vez de devolver o dia UTC anterior silenciosamente', () => {
    // '2026-09-21' (sem `T`) seria interpretado como meia-noite UTC, que em
    // America/Sao_Paulo (UTC-3) cai em 2026-09-20 — errado e silencioso.
    expect(() => dataDeCalendarioDe('2026-09-21')).toThrow(
      /parece uma data de calendário, não um instante/,
    );
  });

  it('aceita instante com hora mas sem Z/offset, interpretado como hora local (America/Sao_Paulo)', () => {
    // Sem `Z`/offset, o `Date` do JS interpreta a string como hora local do
    // processo (`TZ=America/Sao_Paulo`), então 23h30 local já é 2026-09-21.
    expect(() => dataDeCalendarioDe('2026-09-21T23:30:00')).not.toThrow();
    expect(dataDeCalendarioDe('2026-09-21T23:30:00')).toBe('2026-09-21');
  });
});

describe('agoraEmIso', () => {
  it('devolve instante ISO 8601 em UTC, com milissegundos e sufixo Z', () => {
    expect(agoraEmIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe('hojeEmDataDeCalendario', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('é dataDeCalendarioDe(agoraEmIso()) — relógio controlado, não o dia em que a suíte roda', () => {
    vi.setSystemTime(new Date('2026-09-22T02:30:00.000Z'));

    expect(hojeEmDataDeCalendario()).toBe('2026-09-21');
    expect(hojeEmDataDeCalendario()).toBe(dataDeCalendarioDe(agoraEmIso()));
  });
});
