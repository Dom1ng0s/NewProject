/**
 * `dominio/backup/nomes.ts` (ADR 0006, seção 2.5 e critério de aceite 17):
 * nomes de arquivo são identificador técnico (`app-rotina`), nunca
 * `NOME_DO_APP` — a importação nunca depende do nome do arquivo, só do
 * conteúdo, então estes testes fixam a string exata.
 */
import { describe, expect, it } from 'vitest';
import { PREFIXO_DOS_ARQUIVOS, nomeDoArquivoDeBackup, nomeDoArquivoCsv } from './nomes';

describe('PREFIXO_DOS_ARQUIVOS', () => {
  it('é o identificador técnico fixo, não o nome do produto', () => {
    expect(PREFIXO_DOS_ARQUIVOS).toBe('app-rotina');
  });
});

describe('nomeDoArquivoDeBackup', () => {
  it("critério 17: nomeDoArquivoDeBackup('2026-09-22') === 'app-rotina-backup-2026-09-22.json'", () => {
    expect(nomeDoArquivoDeBackup('2026-09-22')).toBe('app-rotina-backup-2026-09-22.json');
  });

  it('muda só a data quando a data muda', () => {
    expect(nomeDoArquivoDeBackup('2026-01-01')).toBe('app-rotina-backup-2026-01-01.json');
  });
});

describe('nomeDoArquivoCsv', () => {
  it("critério 17: nomeDoArquivoCsv('nucleo-configuracoes.csv', '2026-09-22') === 'nucleo-configuracoes-2026-09-22.csv'", () => {
    expect(nomeDoArquivoCsv('nucleo-configuracoes.csv', '2026-09-22')).toBe(
      'nucleo-configuracoes-2026-09-22.csv',
    );
  });

  it('nucleo-historico-de-acoes.csv também recebe a data antes da extensão', () => {
    expect(nomeDoArquivoCsv('nucleo-historico-de-acoes.csv', '2026-09-22')).toBe(
      'nucleo-historico-de-acoes-2026-09-22.csv',
    );
  });

  it('nomeBase sem a extensão .csv também funciona (só acrescenta a data)', () => {
    expect(nomeDoArquivoCsv('nucleo-configuracoes', '2026-09-22')).toBe(
      'nucleo-configuracoes-2026-09-22.csv',
    );
  });
});
