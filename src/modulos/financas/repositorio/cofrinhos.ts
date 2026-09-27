import {
  apenasAtivos,
  atualizarRegistro,
  criarRegistro,
  estaAtivo,
  marcarComoExcluido,
  tabela,
} from '@/persistencia';
import type { RegistroBase } from '@/persistencia';
import { problemasDeCofrinho, problemasDeMovimentoDeCofrinho } from '../dominio/cofrinhos';
import type { DadosDeCofrinho, DadosDeMovimentoDeCofrinho } from '../dominio/cofrinhos';

type RegistroDeCofrinho = DadosDeCofrinho & RegistroBase;
type RegistroDeMovimento = DadosDeMovimentoDeCofrinho & RegistroBase;

export interface Cofrinho extends DadosDeCofrinho {
  readonly id: string;
}

export interface MovimentoDeCofrinho extends DadosDeMovimentoDeCofrinho {
  readonly id: string;
}

/** Campos que a tela de cadastro/edição preenche; `criadoEm` vem de fora (hoje, no momento da criação). */
export interface DadosDeFormularioDeCofrinho {
  readonly nome: string;
  readonly alvoCentavos: number;
  readonly prazo: string | null;
}

function tabelaDeCofrinhos() {
  return tabela<RegistroDeCofrinho>('cofrinhos');
}
function tabelaDeMovimentos() {
  return tabela<RegistroDeMovimento>('movimentosDeCofrinho');
}

function paraCofrinho(registro: RegistroDeCofrinho): Cofrinho {
  return {
    id: registro.id,
    nome: registro.nome,
    alvoCentavos: registro.alvoCentavos,
    prazo: registro.prazo,
    criadoEm: registro.criadoEm,
  };
}

function paraMovimento(registro: RegistroDeMovimento): MovimentoDeCofrinho {
  return {
    id: registro.id,
    cofrinhoId: registro.cofrinhoId,
    valorCentavos: registro.valorCentavos,
    data: registro.data,
  };
}

/** Só ativos, em ordem alfabética (pt-BR). */
export async function listarCofrinhos(): Promise<Cofrinho[]> {
  const registros = await tabelaDeCofrinhos().toArray();
  return apenasAtivos(registros)
    .map(paraCofrinho)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** `null` quando o cofrinho não existe ou já foi excluído. */
export async function obterCofrinho(id: string): Promise<Cofrinho | null> {
  const registro = await tabelaDeCofrinhos().get(id);
  if (!registro || !estaAtivo(registro)) return null;
  return paraCofrinho(registro);
}

/** Todos os movimentos ativos do cofrinho, mais recente primeiro. */
export async function listarMovimentosDoCofrinho(
  cofrinhoId: string,
): Promise<MovimentoDeCofrinho[]> {
  const registros = await tabelaDeMovimentos().where('cofrinhoId').equals(cofrinhoId).toArray();
  return apenasAtivos(registros)
    .map(paraMovimento)
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : a.id < b.id ? 1 : -1));
}

/** Lança se `problemasDeCofrinho` reprovar; nesse caso nada é gravado. `criadoEm` = `hoje` (ADR 0005: data de calendário, não instante). */
export async function criarCofrinho(
  dados: DadosDeFormularioDeCofrinho,
  hoje: string,
): Promise<Cofrinho> {
  const candidato: DadosDeCofrinho = { ...dados, criadoEm: hoje };
  const problemas = problemasDeCofrinho(candidato);
  if (problemas.length > 0) throw new Error(problemas.join('; '));

  const registro = criarRegistro<RegistroDeCofrinho>(candidato);
  await tabelaDeCofrinhos().put(registro);
  return paraCofrinho(registro);
}

/** Lança se a mescla resultante for inválida; nesse caso nada é gravado. Não faz nada se o cofrinho não existir ou já estiver excluído. */
export async function editarCofrinho(
  id: string,
  mudancas: Partial<DadosDeFormularioDeCofrinho>,
): Promise<void> {
  const registro = await tabelaDeCofrinhos().get(id);
  if (!registro || !estaAtivo(registro)) return;

  const candidato: DadosDeCofrinho = { ...paraCofrinho(registro), ...mudancas };
  const problemas = problemasDeCofrinho(candidato);
  if (problemas.length > 0) throw new Error(problemas.join('; '));

  await tabelaDeCofrinhos().put(atualizarRegistro(registro, candidato));
}

/** Soft delete. Não faz nada se o cofrinho não existir ou já estiver excluído. */
export async function excluirCofrinho(id: string): Promise<void> {
  const registro = await tabelaDeCofrinhos().get(id);
  if (!registro || !estaAtivo(registro)) return;
  await tabelaDeCofrinhos().put(marcarComoExcluido(registro));
}

/**
 * Depósito (`valorCentavos` positivo) ou retirada (negativo). Lança se o
 * cofrinho não existir/estiver excluído, ou se `problemasDeMovimentoDeCofrinho`
 * reprovar; nesse caso nada é gravado.
 */
export async function registrarMovimentoDeCofrinho(
  cofrinhoId: string,
  valorCentavos: number,
  hoje: string,
): Promise<MovimentoDeCofrinho> {
  const cofrinho = await tabelaDeCofrinhos().get(cofrinhoId);
  if (!cofrinho || !estaAtivo(cofrinho)) {
    throw new Error('Cofrinho nao encontrado ou ja excluido.');
  }

  const dados: DadosDeMovimentoDeCofrinho = { cofrinhoId, valorCentavos, data: hoje };
  const problemas = problemasDeMovimentoDeCofrinho(dados);
  if (problemas.length > 0) throw new Error(problemas.join('; '));

  const registro = criarRegistro<RegistroDeMovimento>(dados);
  await tabelaDeMovimentos().put(registro);
  return paraMovimento(registro);
}
