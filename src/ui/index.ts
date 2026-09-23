// Componentes visuais genéricos. Nasceram com o item 0.6 (ADR 0006, seção
// 7.8), só o mínimo que a tela Dados usa. O sistema visual definitivo chega
// nos itens 0.7/0.10/0.11.
export { Botao } from './Botao';
export type { BotaoProps, VarianteDoBotao } from './Botao';

export { Campo } from './Campo';
export type { CampoProps } from './Campo';

export { GrupoDeOpcoes } from './GrupoDeOpcoes';
export type { GrupoDeOpcoesProps, OpcaoDoGrupo } from './GrupoDeOpcoes';

export { Aviso } from './Aviso';
export type { AvisoProps, VarianteDoAviso } from './Aviso';

export { salvarArquivo, lerTextoDeArquivo } from './arquivos';
export type { ArquivoParaSalvar, ResultadoDeSalvar } from './arquivos';
