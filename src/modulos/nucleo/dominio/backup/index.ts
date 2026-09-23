/**
 * Interface pública da pasta `dominio/backup/` (ADR 0006, seção 2). Tudo
 * puro: sem React, sem DOM, sem Dexie, sem a camada de persistência. Reexporta o que
 * o repositório (`repositorio/backup.ts`, `repositorio/contrato-de-dados.ts`)
 * e o `index.ts` do módulo consomem.
 */
export { FORMATO_DO_BACKUP, VERSAO_DO_FORMATO_DE_BACKUP, resumirBackup } from './formato';
export type {
  MetadadosDoBackup,
  DadosDeModulo,
  ArquivoDeBackup,
  ResumoDeTabela,
  ResumoDeModulo,
  ResumoDoBackup,
} from './formato';

export { ErroDeBackup, ehErroDeBackup } from './erros';
export type { CodigoDeErroDeBackup } from './erros';

export { montarBackup, serializarBackup, lerBackup, validarRegistrosDaTabela } from './json';
export type { LeituraDeBackup, RegistroDoBackup } from './json';

export { montarCsv } from './csv';
export type { ColunaCsv } from './csv';

export { PREFIXO_DOS_ARQUIVOS, nomeDoArquivoDeBackup, nomeDoArquivoCsv } from './nomes';
