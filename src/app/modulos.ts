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
 * seção 4). Vazio nesta fase: cada pilar acrescenta o seu
 * (`atalhoDeRegistro`) quando ganhar uma tela de registro — treino (1.10),
 * estudos (2.6), finanças (4.6).
 */
export const atalhosDeRegistro: readonly AtalhoDeRegistro[] = [];
