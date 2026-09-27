import {
  apenasAtivos,
  atualizarRegistro,
  criarRegistro,
  estaAtivo,
  marcarComoExcluido,
  tabela,
} from '@/persistencia';
import type { RegistroBase } from '@/persistencia';
import { problemaDeNomeDeCategoria } from '../dominio/categorias';

interface DadosDeCategoria {
  readonly nome: string;
}

type RegistroDeCategoria = DadosDeCategoria & RegistroBase;

export interface Categoria {
  readonly id: string;
  readonly nome: string;
}

function tabelaDeCategorias() {
  return tabela<RegistroDeCategoria>('categorias');
}

function tabelaDeLancamentosParaContagem() {
  return tabela<{ categoriaId: string } & RegistroBase>('lancamentos');
}

function paraCategoria(registro: RegistroDeCategoria): Categoria {
  return { id: registro.id, nome: registro.nome };
}

function compararPorNome(a: Categoria, b: Categoria): number {
  return a.nome.localeCompare(b.nome, 'pt-BR');
}

/** Só ativas, em ordem alfabética (pt-BR). */
export async function listarCategorias(): Promise<Categoria[]> {
  const registros = await tabelaDeCategorias().toArray();
  return apenasAtivos(registros).map(paraCategoria).sort(compararPorNome);
}

/**
 * Categorias ativas ordenadas pelas mais usadas primeiro (contagem de
 * lançamentos ativos que apontam para cada uma), com empate por nome — regra
 * do "gasto em 3 toques" (ESPECIFICACAO §6.2, critério de aceite): "as 4 mais
 * usadas primeiro".
 */
export async function listarCategoriasPorUso(): Promise<Categoria[]> {
  const [categorias, lancamentos] = await Promise.all([
    listarCategorias(),
    tabelaDeLancamentosParaContagem().toArray(),
  ]);

  const contagemPorCategoria = new Map<string, number>();
  for (const lancamento of apenasAtivos(lancamentos)) {
    contagemPorCategoria.set(
      lancamento.categoriaId,
      (contagemPorCategoria.get(lancamento.categoriaId) ?? 0) + 1,
    );
  }

  return [...categorias].sort((a, b) => {
    const usoA = contagemPorCategoria.get(a.id) ?? 0;
    const usoB = contagemPorCategoria.get(b.id) ?? 0;
    return usoB !== usoA ? usoB - usoA : compararPorNome(a, b);
  });
}

/** Lança se o nome for inválido (`problemaDeNomeDeCategoria`). */
export async function criarCategoria(nome: string): Promise<Categoria> {
  const problema = problemaDeNomeDeCategoria(nome);
  if (problema) throw new Error(problema);

  const registro = criarRegistro<RegistroDeCategoria>({ nome: nome.trim() });
  await tabelaDeCategorias().put(registro);
  return paraCategoria(registro);
}

/** Lança se o nome for inválido. Não faz nada se a categoria não existir ou já estiver excluída. */
export async function renomearCategoria(id: string, nome: string): Promise<void> {
  const problema = problemaDeNomeDeCategoria(nome);
  if (problema) throw new Error(problema);

  const registro = await tabelaDeCategorias().get(id);
  if (!registro || !estaAtivo(registro)) return;

  await tabelaDeCategorias().put(atualizarRegistro(registro, { nome: nome.trim() }));
}

/** Soft delete: os lançamentos que já usam esta categoria continuam intactos, referenciando o id. */
export async function excluirCategoria(id: string): Promise<void> {
  const registro = await tabelaDeCategorias().get(id);
  if (!registro || !estaAtivo(registro)) return;

  await tabelaDeCategorias().put(marcarComoExcluido(registro));
}
