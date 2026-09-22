import Dexie from 'dexie';
import type { Table } from 'dexie';
import { MIGRACOES, VERSAO_DO_SCHEMA } from './migracoes';
import type { RegistroBase } from './tipos';

/**
 * Nome técnico e fixo do banco (decisão do usuário, ADR 0005). NÃO deriva do
 * nome do produto: o nome do app ainda é placeholder (pendência 8/9 do
 * plano) e renomear um banco já criado no dispositivo do usuário
 * significaria copiar dados ou perdê-los.
 */
export const NOME_DO_BANCO = 'app-rotina-db';

export const TABELAS = ['configuracoes', 'historicoDeAcoes'] as const;
export type NomeDeTabela = (typeof TABELAS)[number];

export interface OpcoesDoBanco {
  /** Fábrica alternativa de IndexedDB. Usada só pelos testes (ADR 0005, seção 7). */
  indexedDB?: IDBFactory;
}

/** Cria uma instância do banco real, com o schema real e o nome real. */
export function criarBanco(opcoes: OpcoesDoBanco = {}): Dexie {
  const banco = new Dexie(NOME_DO_BANCO, opcoes);
  for (const migracao of MIGRACOES) {
    const versao = banco.version(migracao.versao).stores(migracao.stores);
    if (migracao.upgrade) versao.upgrade(migracao.upgrade);
  }
  return banco;
}

/** Instância usada pelo app inteiro. Abre sozinha na primeira consulta. */
export const db = criarBanco();

/** Acesso tipado a uma tabela. O tipo do registro pertence ao módulo dono. */
export function tabela<T extends RegistroBase>(nome: NomeDeTabela): Table<T, string> {
  return db.table<T, string>(nome);
}

export { VERSAO_DO_SCHEMA };
