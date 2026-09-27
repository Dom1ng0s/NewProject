import type { AtalhoDeRegistro, CartaoDeHoje, ContratoDeDadosDeModulo } from '@/modulos/nucleo';
import { textos } from '@/i18n';
import { CartaoFinancas } from './componentes/CartaoFinancas';
import { contratoDeDadosDoFinancas } from './repositorio/contrato-de-dados';

/**
 * Módulo de finanças (item 1.1/1.2/1.6 do plano): gasto em 3 toques,
 * categorias, orçamento + regra 7.3 (disponível hoje). Assinaturas e
 * cofrinhos ganham tela nos itens 1.3 e 1.5 — só o schema chegou agora.
 */
export const cartaoDeHoje: CartaoDeHoje = {
  modulo: 'financas',
  ordem: 1,
  titulo: textos.financas.hoje.tituloDoCartao,
  Componente: CartaoFinancas,
};

/**
 * Atalho de registro rápido na Hoje (ADR 0009, seção 4): leva direto ao
 * lançamento de gasto, já com o valor focado — 1º dos 3 toques do "gasto em
 * 3 toques" (ESPECIFICACAO §6.2, pendência 5 do plano).
 */
export const atalhoDeRegistro: AtalhoDeRegistro = {
  modulo: 'financas',
  ordem: 1,
  rotulo: textos.financas.atalhoGasto,
  destino: '/financas/novo-lancamento',
};

export const contratoDeDados: ContratoDeDadosDeModulo = contratoDeDadosDoFinancas;

export { Financas } from './telas/Financas';
export { NovoLancamento } from './telas/NovoLancamento';
export { EditarLancamento } from './telas/EditarLancamento';
export { Categorias } from './telas/Categorias';
