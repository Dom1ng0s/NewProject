import { useLiveQuery } from 'dexie-react-hooks';
import { hojeEmDataDeCalendario } from '@/compartilhado';
import { useConfiguracoes } from '@/modulos/nucleo';
import { disponivelHoje } from '../dominio/disponivelHoje';
import { listarCategorias, listarCategoriasPorUso } from './categorias';
import type { Categoria } from './categorias';
import { listarLancamentosDoMes, obterLancamento, totaisDeGastosDoMes } from './lancamentos';
import type { Lancamento } from './lancamentos';

const TOTAIS_PADRAO = { gastosAteOntemEmCentavos: 0, gastosDeHojeEmCentavos: 0 };

/**
 * Regra 7.3, já ligada às configurações e ao banco (`useLiveQuery`
 * recalcula sozinho a cada lançamento/edição/exclusão). `null` sem orçamento
 * definido (D11) — o cartão da Hoje mostra "defina seu orçamento" nesse caso.
 *
 * Consulta limitada ao mês corrente (ADR 0009, seção 3.3, regra 3).
 */
export function useDisponivelHoje(): number | null {
  const configuracoes = useConfiguracoes();
  const hoje = hojeEmDataDeCalendario();
  const anoMes = hoje.slice(0, 7);

  const totais = useLiveQuery(
    () => totaisDeGastosDoMes(anoMes, hoje),
    [anoMes, hoje],
    TOTAIS_PADRAO,
  );

  return disponivelHoje({
    orcamentoMensalEmCentavos: configuracoes.orcamentoMensalEmCentavos,
    hoje,
    gastosDoMesAteOntemEmCentavos: totais.gastosAteOntemEmCentavos,
    gastosDeHojeEmCentavos: totais.gastosDeHojeEmCentavos,
    // Assinaturas ganham cadastro no item 1.3; a tabela já existe (item 1.1),
    // mas nada grava nela ainda — a lista é sempre vazia por enquanto.
    assinaturas: [],
  });
}

/** Todas as categorias ativas, em ordem alfabética. */
export function useCategorias(): Categoria[] {
  return useLiveQuery(listarCategorias, [], []);
}

/** Categorias ativas, as mais usadas primeiro (ESPECIFICACAO §6.2, critério de aceite do gasto em 3 toques). */
export function useCategoriasPorUso(): Categoria[] {
  return useLiveQuery(listarCategoriasPorUso, [], []);
}

/** `anoMes` no formato `AAAA-MM`. */
export function useLancamentosDoMes(anoMes: string): Lancamento[] {
  return useLiveQuery(() => listarLancamentosDoMes(anoMes), [anoMes], []);
}

/** `undefined` enquanto carrega, `null` se não existir (ou estiver excluído). */
export function useLancamento(id: string): Lancamento | null | undefined {
  return useLiveQuery(() => obterLancamento(id), [id]);
}
