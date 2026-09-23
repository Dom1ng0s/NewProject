/**
 * Nomes de arquivo do backup (ADR 0006, seção 2.5). Identificador técnico,
 * NÃO o nome do produto (placeholder, pendência 8/9 do plano). Trocar o
 * prefixo depois é mudar uma constante: a importação nunca depende do nome.
 */
export const PREFIXO_DOS_ARQUIVOS = 'app-rotina';

/** `dia` em `AAAA-MM-DD` → `app-rotina-backup-2026-09-22.json`. */
export function nomeDoArquivoDeBackup(dia: string): string {
  return `${PREFIXO_DOS_ARQUIVOS}-backup-${dia}.json`;
}

/** `('nucleo-historico-de-acoes.csv', '2026-09-22')` → `nucleo-historico-de-acoes-2026-09-22.csv`. */
export function nomeDoArquivoCsv(nomeBase: string, dia: string): string {
  const semExtensao = nomeBase.replace(/\.csv$/, '');
  return `${semExtensao}-${dia}.csv`;
}
