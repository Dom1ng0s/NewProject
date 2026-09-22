import type { Migracao } from './tipos';

/**
 * Schema v1 (ADR 0005, seção 3): só as tabelas do núcleo. Nenhuma tabela de
 * pilar nasce aqui — cada uma nasce na migração da sua própria fase.
 *
 * `configuracoes`: linha única (chave sentinela fixa, sem índice além da
 * chave primária). `historicoDeAcoes`: `dia`, `tipo` e `modulo` indexados
 * (heatmap/XP por período e por pilar); `referenciaId` e índices compostos
 * ficam para quando uma fase precisar.
 *
 * Migração publicada: nunca editar depois de alguém ter aberto o app com
 * ela. Corrigir um erro de schema é `v2`, nunca reescrever `v1Inicial`.
 */
export const v1Inicial: Migracao = {
  versao: 1,
  stores: {
    configuracoes: 'id',
    historicoDeAcoes: 'id, dia, tipo, modulo',
  },
};
