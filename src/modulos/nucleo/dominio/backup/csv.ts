/**
 * CSV por módulo (ADR 0006, seção 3): separador `;`, fim de linha `CRLF`,
 * UTF-8 com BOM — RFC 4180 adaptado para abrir bem no Excel em pt-BR. Puro:
 * sem relógio, sem banco.
 */
export interface ColunaCsv<T> {
  /** Cabeçalho = nome técnico do campo, igual à chave do JSON (`ocorridaEm`). */
  readonly titulo: string;
  readonly valor: (registro: T) => string | number | null;
}

const SEPARADOR_CSV = ';';
const QUEBRA_DE_LINHA_CSV = '\r\n';
const MARCA_DE_ORDEM_DE_BYTES = '﻿';

/**
 * Caractere inicial que um leitor de planilha pode interpretar como início
 * de fórmula (OWASP "CSV Injection", ADR 0006 seção 3.8): `=`, `+`, `-`,
 * `@`, TAB e CR.
 */
const COMECA_COM_CARACTERE_PERIGOSO = /^[=+\-@\t\r]/;

function precisaDeAspas(valor: string): boolean {
  return (
    valor.includes(SEPARADOR_CSV) ||
    valor.includes('"') ||
    valor.includes('\n') ||
    valor.includes('\r')
  );
}

/**
 * Escape RFC 4180 (aspas quando o campo tem `;`, `"`, CR ou LF; `"` interno
 * dobrado) + proteção contra injeção de fórmula (prefixo `'` e sempre entre
 * aspas quando o texto começa com um caractere perigoso).
 */
function escaparCampoDeTexto(valor: string): string {
  const perigoso = COMECA_COM_CARACTERE_PERIGOSO.test(valor);
  const textoProtegido = perigoso ? `'${valor}` : valor;

  if (!perigoso && !precisaDeAspas(textoProtegido)) return textoProtegido;

  return `"${textoProtegido.replace(/"/g, '""')}"`;
}

function formatarCampo(valor: string | number | null): string {
  if (valor === null) return '';
  if (typeof valor === 'number') return String(valor);
  return escaparCampoDeTexto(valor);
}

export function montarCsv<T>(colunas: readonly ColunaCsv<T>[], registros: readonly T[]): string {
  const cabecalho = colunas.map((coluna) => coluna.titulo).join(SEPARADOR_CSV);
  const linhas = registros.map((registro) =>
    colunas.map((coluna) => formatarCampo(coluna.valor(registro))).join(SEPARADOR_CSV),
  );

  return (
    MARCA_DE_ORDEM_DE_BYTES +
    [cabecalho, ...linhas].map((linha) => linha + QUEBRA_DE_LINHA_CSV).join('')
  );
}
