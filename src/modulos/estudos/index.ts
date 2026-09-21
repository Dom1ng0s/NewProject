import type { CartaoDeHoje, ContratoDeDadosDeModulo } from '@/modulos/nucleo';
import { CartaoEstudos } from './componentes/CartaoEstudos';

/**
 * Módulo de estudos: um único index para as duas áreas (`foco/` e
 * `flashcards/`), que dividem a entidade matéria/projeto (`comum/`). Regras,
 * repositório e telas reais chegam nas Fases 2 e 3.
 */
export const cartaoDeHoje: CartaoDeHoje = {
  modulo: 'estudos',
  ordem: 2,
  Componente: CartaoEstudos,
};

export const contratoDeDados: ContratoDeDadosDeModulo = {
  modulo: 'estudos',
  exportarJson: () => Promise.resolve({}),
  importarJson: () => Promise.resolve(),
  exportarCsv: () => Promise.resolve([]),
  apagarTudo: () => Promise.resolve(),
};
