import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { hojeEmDataDeCalendario } from '@/compartilhado';
import { useConfiguracoes } from '@/modulos/nucleo';
import { assinaturasParaAvisoDeRenovacao } from '../dominio/assinaturas';
import { projetarConclusaoDoCofrinho, saldoDoCofrinho } from '../dominio/cofrinhos';
import type { ProjecaoDeCofrinho } from '../dominio/cofrinhos';
import { disponivelHoje } from '../dominio/disponivelHoje';
import {
  contarUsosNoMes,
  listarAssinaturas,
  obterAssinatura,
  processarCobrancasAutomaticas,
} from './assinaturas';
import type { Assinatura } from './assinaturas';
import { listarCategorias, listarCategoriasPorUso } from './categorias';
import type { Categoria } from './categorias';
import {
  listarCofrinhos,
  listarMovimentosDoCofrinho,
  obterCofrinho,
} from './cofrinhos';
import type { Cofrinho, MovimentoDeCofrinho } from './cofrinhos';
import { listarLancamentosDoMes, obterLancamento, totaisDeGastosDoMes } from './lancamentos';
import type { Lancamento } from './lancamentos';

const TOTAIS_PADRAO = { gastosAteOntemEmCentavos: 0, gastosDeHojeEmCentavos: 0 };

/**
 * Regra 7.3, já ligada às configurações e ao banco (`useLiveQuery`
 * recalcula sozinho a cada lançamento/edição/exclusão, e a cada assinatura
 * criada/editada). `null` sem orçamento definido (D11) — o cartão da Hoje
 * mostra "defina seu orçamento" nesse caso.
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
  const assinaturas = useAssinaturas();

  return disponivelHoje({
    orcamentoMensalEmCentavos: configuracoes.orcamentoMensalEmCentavos,
    hoje,
    gastosDoMesAteOntemEmCentavos: totais.gastosAteOntemEmCentavos,
    gastosDeHojeEmCentavos: totais.gastosDeHojeEmCentavos,
    assinaturas: assinaturas.map((assinatura) => ({
      valorCentavos: assinatura.valorCentavos,
      proximaCobranca: assinatura.proximaCobranca,
    })),
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

/** Assinaturas ativas (item 1.3), ordenadas pela próxima cobrança mais próxima. */
export function useAssinaturas(): Assinatura[] {
  return useLiveQuery(listarAssinaturas, [], []);
}

/** `undefined` enquanto carrega, `null` se não existir (ou estiver excluída). */
export function useAssinatura(id: string): Assinatura | null | undefined {
  return useLiveQuery(() => obterAssinatura(id), [id]);
}

/** Quantidade de usos ativos no mês corrente — base do custo por uso (item 1.3). */
export function useUsosNoMes(assinaturaId: string): number {
  const hoje = hojeEmDataDeCalendario();
  const anoMes = hoje.slice(0, 7);
  return useLiveQuery(() => contarUsosNoMes(assinaturaId, anoMes), [assinaturaId, anoMes], 0);
}

/**
 * Assinaturas com cobrança dentro dos próximos `diasDeAviso` dias (item 1.4).
 * Usada tanto pela faixa na Hoje quanto pela tela de assinaturas.
 */
export function useAssinaturasParaAvisoDeRenovacao(): Assinatura[] {
  const assinaturas = useAssinaturas();
  const hoje = hojeEmDataDeCalendario();
  return assinaturasParaAvisoDeRenovacao(assinaturas, hoje);
}

/**
 * Roda a cobrança automática (item 1.3, ESPECIFICACAO §6.2) uma vez ao
 * montar (equivalente a "ao abrir o app", já que a Hoje é a rota inicial) e
 * de novo sempre que a aba volta a ficar visível (`visibilitychange` —
 * "voltar para o app"). `processarCobrancasAutomaticas` é idempotente: rodar
 * duas vezes seguidas não duplica lançamento.
 */
export function useProcessarCobrancasAutomaticas(): void {
  useEffect(() => {
    function processar(): void {
      void processarCobrancasAutomaticas(hojeEmDataDeCalendario());
    }

    processar();

    function aoMudarVisibilidade(): void {
      if (document.visibilityState === 'visible') processar();
    }

    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => document.removeEventListener('visibilitychange', aoMudarVisibilidade);
  }, []);
}

/** Cofrinhos ativos (item 1.5), em ordem alfabética. */
export function useCofrinhos(): Cofrinho[] {
  return useLiveQuery(listarCofrinhos, [], []);
}

/** `undefined` enquanto carrega, `null` se não existir (ou estiver excluído). */
export function useCofrinho(id: string): Cofrinho | null | undefined {
  return useLiveQuery(() => obterCofrinho(id), [id]);
}

/** Todos os movimentos ativos de um cofrinho, mais recente primeiro. */
export function useMovimentosDoCofrinho(cofrinhoId: string): MovimentoDeCofrinho[] {
  return useLiveQuery(() => listarMovimentosDoCofrinho(cofrinhoId), [cofrinhoId], []);
}

/**
 * Regra 7.4 já ligada aos dados: recalcula sozinha a cada depósito/retirada
 * (via `movimentos`, que vem de `useMovimentosDoCofrinho`) — é assim que o
 * critério de aceite "a data projetada fica mais próxima na mesma tela, sem
 * recarregar" se cumpre. `null` enquanto o cofrinho ainda não carregou.
 */
export function useProjecaoDoCofrinho(
  cofrinho: Cofrinho | null | undefined,
  movimentos: readonly MovimentoDeCofrinho[],
): ProjecaoDeCofrinho | null {
  if (!cofrinho) return null;
  const hoje = hojeEmDataDeCalendario();
  const saldoAtualCentavos = saldoDoCofrinho(movimentos);
  return projetarConclusaoDoCofrinho({
    alvoCentavos: cofrinho.alvoCentavos,
    saldoAtualCentavos,
    criadoEm: cofrinho.criadoEm,
    hoje,
    movimentos,
  });
}
