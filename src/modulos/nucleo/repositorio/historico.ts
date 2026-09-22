import { agoraEmIso, dataDeCalendarioDe } from '@/compartilhado';
import { apenasAtivos, criarRegistro, estaAtivo, marcarComoExcluido, tabela } from '@/persistencia';
import type { RegistroBase } from '@/persistencia';
import { moduloDoTipo } from '../dominio/historico';
import type { AcaoDoHistorico, EntradaDeAcao } from '../dominio/historico';

type RegistroDeAcao = AcaoDoHistorico & RegistroBase;

function tabelaDeAcoes() {
  return tabela<RegistroDeAcao>('historicoDeAcoes');
}

function compararStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * `dia` sai de `ocorridaEm`; lança se `tipo` não começar com `${modulo}.`
 * (invariante do histórico único, ADR 0005, seção 3.2).
 */
export async function registrarAcao(entrada: EntradaDeAcao): Promise<void> {
  if (moduloDoTipo(entrada.tipo) !== entrada.modulo) {
    throw new Error(`Tipo de acao "${entrada.tipo}" nao pertence ao modulo "${entrada.modulo}".`);
  }

  const ocorridaEm = entrada.ocorridaEm ?? agoraEmIso();
  const dados: AcaoDoHistorico = {
    tipo: entrada.tipo,
    modulo: entrada.modulo,
    referenciaId: entrada.referenciaId,
    quantidade: entrada.quantidade,
    ocorridaEm,
    dia: dataDeCalendarioDe(ocorridaEm),
  };

  await tabelaDeAcoes().put(criarRegistro<RegistroDeAcao>(dados));
}

/**
 * Dias inclusive, `AAAA-MM-DD`. Só ativas (soft delete filtrado em memória,
 * nunca por índice — ADR 0005, seção 3.4), ordenadas por `ocorridaEm` e
 * depois por `id`.
 */
export async function listarAcoesDoPeriodo(
  deDia: string,
  ateDia: string,
): Promise<AcaoDoHistorico[]> {
  const registros = await tabelaDeAcoes().where('dia').between(deDia, ateDia, true, true).toArray();

  return apenasAtivos(registros).sort((a, b) =>
    a.ocorridaEm === b.ocorridaEm
      ? compararStrings(a.id, b.id)
      : compararStrings(a.ocorridaEm, b.ocorridaEm),
  );
}

/** Soft delete: preenche `deletedAt`, mantém a linha. */
export async function excluirAcao(id: string): Promise<void> {
  const registro = await tabelaDeAcoes().get(id);
  if (!registro || !estaAtivo(registro)) return;
  await tabelaDeAcoes().put(marcarComoExcluido(registro));
}
