import { ErroDeBackup } from '@/modulos/nucleo';
import type { CartaoDeHoje, ContratoDeDadosDeModulo } from '@/modulos/nucleo';
import { textos } from '@/i18n';
import { CartaoFinancas } from './componentes/CartaoFinancas';

/**
 * Módulo de finanças. Regras (seção 7.3 e 7.4), repositório e telas reais
 * chegam na Fase 4. Por enquanto o contrato de dados devolve listas vazias.
 */
export const cartaoDeHoje: CartaoDeHoje = {
  modulo: 'financas',
  ordem: 1,
  titulo: textos.financas.hoje.tituloDoCartao,
  Componente: CartaoFinancas,
};

export const contratoDeDados: ContratoDeDadosDeModulo = {
  modulo: 'financas',
  exportarJson: () => Promise.resolve({}),
  importarJson: (dados) => {
    if (Object.keys(dados).length > 0) {
      throw new ErroDeBackup('registroInvalido', 'Modulo "financas" ainda nao possui tabelas.');
    }
    return Promise.resolve();
  },
  exportarCsv: () => Promise.resolve([]),
  apagarTudo: () => Promise.resolve(),
};
