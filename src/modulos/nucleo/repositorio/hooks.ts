import { useLiveQuery } from 'dexie-react-hooks';
import { CONFIGURACOES_PADRAO } from '../dominio/configuracoes';
import type { Configuracoes } from '../dominio/configuracoes';
import { obterConfiguracoes } from './configuracoes';

/**
 * Único arquivo do domínio do núcleo com React (ADR 0002, seção "quem faz o
 * quê"). Nunca devolve `undefined`: o terceiro argumento do `useLiveQuery` é
 * `CONFIGURACOES_PADRAO`, o mesmo valor que `obterConfiguracoes` devolveria
 * sem linha no banco.
 */
export function useConfiguracoes(): Configuracoes {
  return useLiveQuery(obterConfiguracoes, [], CONFIGURACOES_PADRAO);
}
