import * as nucleo from '@/modulos/nucleo';
import * as treino from '@/modulos/treino';
import * as estudos from '@/modulos/estudos';
import * as financas from '@/modulos/financas';
import type { AtalhoDeRegistro } from '@/modulos/nucleo';

export const cartoesDaHoje = [
  nucleo.cartaoDeHoje,
  treino.cartaoDeHoje,
  estudos.cartaoDeHoje,
  financas.cartaoDeHoje,
];
export const contratosDeDados = [
  nucleo.contratoDeDados,
  treino.contratoDeDados,
  estudos.contratoDeDados,
  financas.contratoDeDados,
];

/**
 * Atalhos de registro rápido na área "Registrar agora" da Hoje (ADR 0009,
 * seção 4). Financas entra no item 1.1 (Fase 1); os demais pilares
 * acrescentam o seu quando ganharem tela de registro — estudos (2.6), treino
 * (3.9).
 */
export const atalhosDeRegistro: readonly AtalhoDeRegistro[] = [financas.atalhoDeRegistro];
