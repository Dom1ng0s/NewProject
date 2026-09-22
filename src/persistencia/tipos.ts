import { agoraEmIso, gerarIdentificador } from '@/compartilhado';

/**
 * Campos de controle de todo registro persistido (ADR 0002: sempre em
 * inglês). Não são `readonly`: as funções de upgrade das migrações e o
 * `Collection.modify` do Dexie mutam o objeto, e o IndexedDB já devolve uma
 * cópia a cada leitura.
 */
export interface RegistroBase {
  /** UUID v7 (`@/compartilhado`): único e ordenável cronologicamente como string. */
  id: string;
  /** Instante ISO 8601 em UTC com milissegundos: `2026-09-21T16:04:05.123Z`. */
  createdAt: string;
  /** Igual a `createdAt` na criação; muda a cada gravação. */
  updatedAt: string;
  /** `null` = ativo. Instante ISO em UTC quando excluído (soft delete). */
  deletedAt: string | null;
}

/** Os campos de negócio de um registro, sem os campos de controle. */
export type DadosDoRegistro<T extends RegistroBase> = Omit<T, keyof RegistroBase>;

/**
 * Cria um registro novo: gera `id` (UUID v7) e `createdAt`/`updatedAt` iguais
 * ao instante atual, com `deletedAt` nulo (ativo). É o único lugar que lê o
 * relógio e o gerador de id para criação — nenhum repositório monta esses
 * campos na mão.
 *
 * O cast é seguro: `T` é `DadosDoRegistro<T> & RegistroBase` por construção
 * (T extends RegistroBase), mas o compilador não infere essa igualdade para
 * um tipo genérico.
 */
export function criarRegistro<T extends RegistroBase>(dados: DadosDoRegistro<T>): T {
  const agora = agoraEmIso();
  return {
    ...dados,
    id: gerarIdentificador(),
    createdAt: agora,
    updatedAt: agora,
    deletedAt: null,
  } as T;
}

/**
 * Devolve uma cópia de `registro` com `mudancas` aplicadas e `updatedAt`
 * renovado; `createdAt` e `id` nunca mudam aqui.
 */
export function atualizarRegistro<T extends RegistroBase>(
  registro: T,
  mudancas: Partial<DadosDoRegistro<T>>,
): T {
  return {
    ...registro,
    ...mudancas,
    updatedAt: agoraEmIso(),
  };
}

/** Soft delete: preenche `deletedAt` e `updatedAt`; nunca apaga a linha. */
export function marcarComoExcluido<T extends RegistroBase>(registro: T): T {
  const agora = agoraEmIso();
  return {
    ...registro,
    deletedAt: agora,
    updatedAt: agora,
  };
}

/** `true` quando o registro não está excluído (soft delete). */
export function estaAtivo(registro: RegistroBase): boolean {
  return registro.deletedAt === null;
}

/**
 * Filtra só os registros ativos. Uso obrigatório após consultar por índice
 * de negócio: o IndexedDB não indexa `null`, então nunca se consulta soft
 * delete por `where('deletedAt')` (ADR 0005, seção 3.4).
 */
export function apenasAtivos<T extends RegistroBase>(registros: readonly T[]): T[] {
  return registros.filter(estaAtivo);
}
