import type { Configuracoes } from '@/modulos/nucleo';

export type TemaResolvido = 'claro' | 'escuro';

/**
 * Regra de apresentação (ADR 0008, seção 6/12), não de negócio: resolve a
 * preferência de tema gravada em `Configuracoes` contra o sistema. Pura, sem
 * DOM — `useAplicarTema` é quem aplica o resultado.
 */
export function resolverTema(tema: Configuracoes['tema'], sistemaEscuro: boolean): TemaResolvido {
  if (tema === 'sistema') {
    return sistemaEscuro ? 'escuro' : 'claro';
  }
  return tema;
}
