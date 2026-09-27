import { registrarAcao } from '@/modulos/nucleo';
import {
  apenasAtivos,
  atualizarRegistro,
  criarRegistro,
  emTransacao,
  estaAtivo,
  marcarComoExcluido,
  tabela,
} from '@/persistencia';
import type { RegistroBase } from '@/persistencia';
import { problemasDeLancamento } from '../dominio/lancamentos';
import type { DadosDeLancamento } from '../dominio/lancamentos';

type RegistroDeLancamento = DadosDeLancamento & RegistroBase;

export interface Lancamento extends DadosDeLancamento {
  readonly id: string;
}

function tabelaDeLancamentos() {
  return tabela<RegistroDeLancamento>('lancamentos');
}

function paraLancamento(registro: RegistroDeLancamento): Lancamento {
  return {
    id: registro.id,
    tipo: registro.tipo,
    valorCentavos: registro.valorCentavos,
    categoriaId: registro.categoriaId,
    descricao: registro.descricao,
    data: registro.data,
    assinaturaId: registro.assinaturaId,
  };
}

/** Mais recente primeiro; empate por `id` (também decrescente, para ordem estável). */
function compararDoMaisRecente(a: Lancamento, b: Lancamento): number {
  if (a.data !== b.data) return a.data < b.data ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

/** Instante ISO ao meio-dia local do dia informado — evita que a conversão de volta (`dataDeCalendarioDe`) caia no dia errado perto da virada de fuso. */
function instanteAoMeioDiaLocal(dataAaaaMmDd: string): string {
  const [anoTexto, mesTexto, diaTexto] = dataAaaaMmDd.split('-');
  const data = new Date(Number(anoTexto), Number(mesTexto) - 1, Number(diaTexto), 12, 0, 0, 0);
  return data.toISOString();
}

/** `anoMes` no formato `AAAA-MM`. Só ativos, do mais recente para o mais antigo. */
export async function listarLancamentosDoMes(anoMes: string): Promise<Lancamento[]> {
  const inicio = `${anoMes}-01`;
  const fim = `${anoMes}-31`; // "31" nunca existe de verdade num mês menor; between é só comparação de string.
  const registros = await tabelaDeLancamentos()
    .where('data')
    .between(inicio, fim, true, true)
    .toArray();
  return apenasAtivos(registros).map(paraLancamento).sort(compararDoMaisRecente);
}

/** `null` quando o lançamento não existe ou já foi excluído. */
export async function obterLancamento(id: string): Promise<Lancamento | null> {
  const registro = await tabelaDeLancamentos().get(id);
  if (!registro || !estaAtivo(registro)) return null;
  return paraLancamento(registro);
}

export interface TotaisDeGastosDoMes {
  readonly gastosAteOntemEmCentavos: number;
  readonly gastosDeHojeEmCentavos: number;
}

/** Soma dos GASTOS do mês (entradas não entram, regra 7.3), separados em "até ontem" e "hoje". */
export async function totaisDeGastosDoMes(
  anoMes: string,
  hoje: string,
): Promise<TotaisDeGastosDoMes> {
  const lancamentos = await listarLancamentosDoMes(anoMes);
  let gastosAteOntemEmCentavos = 0;
  let gastosDeHojeEmCentavos = 0;

  for (const lancamento of lancamentos) {
    if (lancamento.tipo !== 'gasto') continue;
    if (lancamento.data === hoje) gastosDeHojeEmCentavos += lancamento.valorCentavos;
    else if (lancamento.data < hoje) gastosAteOntemEmCentavos += lancamento.valorCentavos;
  }

  return { gastosAteOntemEmCentavos, gastosDeHojeEmCentavos };
}

/**
 * Grava o lançamento e registra `'financas.lancamentoRegistrado'` no
 * histórico, na MESMA transação — `ocorridaEm` reflete a data do lançamento
 * (pode ser retroativa), não o instante em que o app gravou. Lança se
 * `problemasDeLancamento` reprovar; nesse caso nada é gravado.
 */
export async function registrarLancamento(dados: DadosDeLancamento): Promise<Lancamento> {
  const problemas = problemasDeLancamento(dados);
  if (problemas.length > 0) throw new Error(problemas.join('; '));

  return emTransacao(['lancamentos', 'historicoDeAcoes'], async () => {
    const registro = criarRegistro<RegistroDeLancamento>(dados);
    await tabelaDeLancamentos().put(registro);
    await registrarAcao({
      tipo: 'financas.lancamentoRegistrado',
      modulo: 'financas',
      referenciaId: registro.id,
      quantidade: dados.valorCentavos,
      ocorridaEm: instanteAoMeioDiaLocal(dados.data),
    });
    return paraLancamento(registro);
  });
}

/**
 * Lança se a mescla resultante for inválida; nesse caso nada é gravado. Não
 * faz nada se o lançamento não existir ou já estiver excluído.
 */
export async function editarLancamento(
  id: string,
  mudancas: Partial<DadosDeLancamento>,
): Promise<void> {
  const registro = await tabelaDeLancamentos().get(id);
  if (!registro || !estaAtivo(registro)) return;

  const candidato: DadosDeLancamento = { ...paraLancamento(registro), ...mudancas };
  const problemas = problemasDeLancamento(candidato);
  if (problemas.length > 0) throw new Error(problemas.join('; '));

  await tabelaDeLancamentos().put(atualizarRegistro(registro, candidato));
}

/** Soft delete. Não faz nada se o lançamento não existir ou já estiver excluído. */
export async function excluirLancamento(id: string): Promise<void> {
  const registro = await tabelaDeLancamentos().get(id);
  if (!registro || !estaAtivo(registro)) return;

  await tabelaDeLancamentos().put(marcarComoExcluido(registro));
}
