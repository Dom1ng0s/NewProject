export type { IdDeModulo, CartaoDeHoje, ArquivoCsv, ContratoDeDadosDeModulo } from './tipos';
export type { Configuracoes, MudancasDeConfiguracoes } from './dominio/configuracoes';
export type {
  CampoNumericoDeConfiguracoes,
  ProblemaDeConfiguracoes,
} from './dominio/configuracoes';
export type { AcaoDoHistorico, EntradaDeAcao, TipoDeAcao } from './dominio/historico';
export {
  CONFIGURACOES_PADRAO,
  aplicarMudancas,
  problemasDeConfiguracoes,
} from './dominio/configuracoes';
export { obterConfiguracoes, salvarConfiguracoes } from './repositorio/configuracoes';
export { registrarAcao, listarAcoesDoPeriodo, excluirAcao } from './repositorio/historico';
export { useConfiguracoes } from './repositorio/hooks';
export { solicitarArmazenamentoPersistente } from './repositorio/armazenamento';

export {
  exportarBackup,
  exportarCsvPorModulo,
  importarBackup,
  apagarTudo,
  VERSAO_DO_SCHEMA,
} from './repositorio/backup';
export type { CsvsDeModulo, ResultadoDaImportacao } from './repositorio/backup';
export {
  serializarBackup,
  lerBackup,
  resumirBackup,
  montarCsv,
  nomeDoArquivoDeBackup,
  nomeDoArquivoCsv,
  ErroDeBackup,
  ehErroDeBackup,
  FORMATO_DO_BACKUP,
  VERSAO_DO_FORMATO_DE_BACKUP,
} from './dominio/backup';
export type {
  ArquivoDeBackup,
  MetadadosDoBackup,
  DadosDeModulo,
  ResumoDoBackup,
  ResumoDeModulo,
  ResumoDeTabela,
  LeituraDeBackup,
  CodigoDeErroDeBackup,
  ColunaCsv,
} from './dominio/backup';

import type { CartaoDeHoje, ContratoDeDadosDeModulo } from './tipos';
import { CartaoNucleo } from './componentes/CartaoNucleo';
import { contratoDeDadosDoNucleo } from './repositorio/contrato-de-dados';

export const cartaoDeHoje: CartaoDeHoje = {
  modulo: 'nucleo',
  ordem: 0,
  Componente: CartaoNucleo,
};

export const contratoDeDados: ContratoDeDadosDeModulo = contratoDeDadosDoNucleo;

/** A tela de dados/backup (ADR 0006, seção 7). `rotas.tsx` monta a rota `/dados`. */
export { Dados } from './telas/Dados';
export type { DadosProps } from './telas/Dados';

/** A tela de configurações (ADR 0008). `rotas.tsx` monta a rota `/configuracoes`. */
export { TelaDeConfiguracoes } from './telas/Configuracoes';
