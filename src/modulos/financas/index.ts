import type { CartaoDeHoje, ContratoDeDadosDeModulo } from '@/modulos/nucleo';
import { CartaoFinancas } from './componentes/CartaoFinancas';

/**
 * Módulo de finanças. Regras (seção 7.3 e 7.4), repositório e telas reais
 * chegam na Fase 4. Por enquanto o contrato de dados devolve listas vazias.
 */
export const cartaoDeHoje: CartaoDeHoje = {
  modulo: 'financas',
  ordem: 3,
  Componente: CartaoFinancas,
};

export const contratoDeDados: ContratoDeDadosDeModulo = {
  modulo: 'financas',
  exportarJson: () => Promise.resolve({}),
  importarJson: () => Promise.resolve(),
  exportarCsv: () => Promise.resolve([]),
  apagarTudo: () => Promise.resolve(),
};
