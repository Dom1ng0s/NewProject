/**
 * `dominio/backup/csv.ts` (ADR 0006, seção 3): RFC 4180 adaptado (separador
 * `;`, CRLF, BOM) + proteção contra injeção de fórmula (OWASP "CSV
 * Injection"). Cobre os critérios de aceite 15 e 16 do ADR no nível da
 * função pura (o nível de módulo/tabela real fica em
 * `repositorio/contrato-de-dados.test.ts`).
 */
import { describe, expect, it } from 'vitest';
import { montarCsv } from './csv';
import type { ColunaCsv } from './csv';

const BOM = '﻿';
const CRLF = '\r\n';

interface RegistroDeProva {
  readonly id: string;
  readonly texto: string | null;
  readonly valor: number;
}

const COLUNAS: readonly ColunaCsv<RegistroDeProva>[] = [
  { titulo: 'id', valor: (r) => r.id },
  { titulo: 'texto', valor: (r) => r.texto },
  { titulo: 'valor', valor: (r) => r.valor },
];

describe('montarCsv', () => {
  it('critério 15: começa com BOM, usa ";" e CRLF, cabeçalho na ordem declarada', () => {
    const csv = montarCsv(COLUNAS, [{ id: '1', texto: 'ok', valor: 10 }]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toContain(`id;texto;valor${CRLF}`);
    expect(csv).toBe(`${BOM}id;texto;valor${CRLF}1;ok;10${CRLF}`);
  });

  it('critério 15: tabela vazia traz só o cabeçalho (com BOM e CRLF)', () => {
    const csv = montarCsv(COLUNAS, []);
    expect(csv).toBe(`${BOM}id;texto;valor${CRLF}`);
  });

  it('critério 16: null vira campo vazio', () => {
    const csv = montarCsv(COLUNAS, [{ id: '1', texto: null, valor: 0 }]);
    expect(csv).toBe(`${BOM}id;texto;valor${CRLF}1;;0${CRLF}`);
  });

  it('critério 16: número sai sem formatação (negativo, zero, grande)', () => {
    const csv = montarCsv(COLUNAS, [
      { id: '1', texto: null, valor: -12345 },
      { id: '2', texto: null, valor: 0 },
      { id: '3', texto: null, valor: 1000000 },
    ]);
    const linhas = csv.slice(BOM.length).split(CRLF).filter(Boolean);
    expect(linhas).toEqual(['id;texto;valor', '1;;-12345', '2;;0', '3;;1000000']);
  });

  it('critério 16: texto com ";" fica entre aspas', () => {
    const csv = montarCsv(COLUNAS, [{ id: '1', texto: 'a;b', valor: 1 }]);
    expect(csv).toBe(`${BOM}id;texto;valor${CRLF}1;"a;b";1${CRLF}`);
  });

  it('critério 16: aspas internas são dobradas', () => {
    const csv = montarCsv(COLUNAS, [{ id: '1', texto: 'disse "oi"', valor: 1 }]);
    expect(csv).toBe(`${BOM}id;texto;valor${CRLF}1;"disse ""oi""";1${CRLF}`);
  });

  it('critério 16: quebra de linha embutida no texto é preservada entre aspas', () => {
    const csv = montarCsv(COLUNAS, [{ id: '1', texto: 'linha1\nlinha2', valor: 1 }]);
    expect(csv).toBe(`${BOM}id;texto;valor${CRLF}1;"linha1\nlinha2";1${CRLF}`);
  });

  it.each([
    ['=SOMA(A1:A2)', "'=SOMA(A1:A2)"],
    ['+1+1', "'+1+1"],
    ['-1-1', "'-1-1"],
    ['@mencao', "'@mencao"],
    ['\tcomeça com tab', "'\tcomeça com tab"],
  ])(
    'critério 16 (injeção de fórmula): "%s" sai prefixado com \' e entre aspas',
    (entrada, esperadoSemAspas) => {
      const csv = montarCsv(COLUNAS, [{ id: '1', texto: entrada, valor: 1 }]);
      const linhaDeDados = csv.slice(BOM.length).split(CRLF)[1];
      expect(linhaDeDados).toBe(`1;"${esperadoSemAspas}";1`);
    },
  );

  it('critério 16: valor negativo NUMÉRICO não é afetado pela proteção de fórmula (regra vale só para texto)', () => {
    const csv = montarCsv(COLUNAS, [{ id: '1', texto: null, valor: -50 }]);
    const linhaDeDados = csv.slice(BOM.length).split(CRLF)[1];
    expect(linhaDeDados).toBe('1;;-50');
  });

  it('combina prefixo de fórmula com aspas internas dobradas (perigoso + escapável ao mesmo tempo)', () => {
    const csv = montarCsv(COLUNAS, [{ id: '1', texto: '=a"b', valor: 1 }]);
    const linhaDeDados = csv.slice(BOM.length).split(CRLF)[1];
    expect(linhaDeDados).toBe(`1;"'=a""b";1`);
  });
});
