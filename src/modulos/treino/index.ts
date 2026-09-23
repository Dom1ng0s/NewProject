import { ErroDeBackup } from '@/modulos/nucleo';
import type { CartaoDeHoje, ContratoDeDadosDeModulo } from '@/modulos/nucleo';
import { textos } from '@/i18n';
import { CartaoTreino } from './componentes/CartaoTreino';

/**
 * Módulo de treino. Regras (seção 7.5 a 7.9), repositório e telas reais
 * chegam na Fase 1. Por enquanto o contrato de dados devolve listas vazias.
 */
export const cartaoDeHoje: CartaoDeHoje = {
  modulo: 'treino',
  ordem: 3,
  titulo: textos.treino.hoje.tituloDoCartao,
  Componente: CartaoTreino,
};

export const contratoDeDados: ContratoDeDadosDeModulo = {
  modulo: 'treino',
  exportarJson: () => Promise.resolve({}),
  importarJson: (dados) => {
    if (Object.keys(dados).length > 0) {
      throw new ErroDeBackup('registroInvalido', 'Modulo "treino" ainda nao possui tabelas.');
    }
    return Promise.resolve();
  },
  exportarCsv: () => Promise.resolve([]),
  apagarTudo: () => Promise.resolve(),
};
