import type { CartaoDeHoje, ContratoDeDadosDeModulo } from '@/modulos/nucleo';
import { CartaoTreino } from './componentes/CartaoTreino';

/**
 * Módulo de treino. Regras (seção 7.5 a 7.9), repositório e telas reais
 * chegam na Fase 1. Por enquanto o contrato de dados devolve listas vazias.
 */
export const cartaoDeHoje: CartaoDeHoje = {
  modulo: 'treino',
  ordem: 1,
  Componente: CartaoTreino,
};

export const contratoDeDados: ContratoDeDadosDeModulo = {
  modulo: 'treino',
  exportarJson: () => Promise.resolve({}),
  importarJson: () => Promise.resolve(),
  exportarCsv: () => Promise.resolve([]),
  apagarTudo: () => Promise.resolve(),
};
