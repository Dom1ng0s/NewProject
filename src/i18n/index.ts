import { comum } from './pt-BR/comum';
import { nucleo } from './pt-BR/nucleo';
import { treino } from './pt-BR/treino';
import { estudos } from './pt-BR/estudos';
import { financas } from './pt-BR/financas';

export const NOME_DO_APP = comum.nomeDoApp;

/** Todos os textos visíveis do app, em pt-BR, por módulo. */
export const textos = {
  comum,
  nucleo,
  treino,
  estudos,
  financas,
} as const;
