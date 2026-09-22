export type { IdDeModulo, CartaoDeHoje, ArquivoCsv, ContratoDeDadosDeModulo } from './tipos';
export type { Configuracoes, MudancasDeConfiguracoes } from './dominio/configuracoes';
export type { AcaoDoHistorico, EntradaDeAcao, TipoDeAcao } from './dominio/historico';
export { CONFIGURACOES_PADRAO } from './dominio/configuracoes';
export { obterConfiguracoes, salvarConfiguracoes } from './repositorio/configuracoes';
export { registrarAcao, listarAcoesDoPeriodo, excluirAcao } from './repositorio/historico';
export { useConfiguracoes } from './repositorio/hooks';

import type { CartaoDeHoje, ContratoDeDadosDeModulo } from './tipos';
import { CartaoNucleo } from './componentes/CartaoNucleo';

export const cartaoDeHoje: CartaoDeHoje = {
  modulo: 'nucleo',
  ordem: 0,
  Componente: CartaoNucleo,
};

/**
 * Backup real (exportar/importar/apagar tudo) chega no item 0.6. Por ora o
 * núcleo ainda não tem tabelas próprias (configurações, histórico chegam nos
 * itens 0.10 e 0.12), então o contrato devolve estruturas vazias.
 */
export const contratoDeDados: ContratoDeDadosDeModulo = {
  modulo: 'nucleo',
  exportarJson: () => Promise.resolve({}),
  importarJson: () => Promise.resolve(),
  exportarCsv: () => Promise.resolve([]),
  apagarTudo: () => Promise.resolve(),
};
