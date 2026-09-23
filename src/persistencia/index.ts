/**
 * Interface pública da camada de persistência (ADR 0002/0005). Só as pastas
 * `repositorio/` dos módulos podem importar daqui — nunca um arquivo interno
 * (`./db`, `./tipos`, etc.) diretamente.
 */
export { db, criarBanco, tabela, TABELAS, NOME_DO_BANCO, VERSAO_DO_SCHEMA } from './db';
export type { NomeDeTabela, OpcoesDoBanco } from './db';
export { emTransacao, emTransacaoDeLeitura } from './transacao';
export {
  criarRegistro,
  atualizarRegistro,
  marcarComoExcluido,
  estaAtivo,
  apenasAtivos,
} from './tipos';
export type { RegistroBase, DadosDoRegistro } from './tipos';
export { solicitarArmazenamentoPersistente } from './armazenamento';
