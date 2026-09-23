import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

/**
 * WCAG 2.2 AA (especificacao, secao 9). As etiquetas do axe NAO sao cumulativas:
 * `wcag22aa` nao contem `wcag2a`. Por isso as cinco precisam estar na lista.
 */
export const ETIQUETAS_WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Promoção de `best-practice` ao portão (ADR 0009, seção 7; fecha a pendência
 * 15 do ADR 0004). Traz, entre outras, `landmark-one-main`,
 * `page-has-heading-one`, `region`, `heading-order`, `landmark-unique` e
 * `empty-heading`. Vale para TODAS as telas a partir deste item.
 */
const ETIQUETAS_DO_PORTAO = [...ETIQUETAS_WCAG_AA, 'best-practice'];

export async function verificarAcessibilidade(
  page: Page,
  info: TestInfo,
  nomeDaTela: string,
  /**
   * Regras `best-practice` desligadas individualmente para esta tela, cada
   * uma com o motivo registrado no comentário do teste que a passa e em
   * `docs/PLANO.md` (ADR 0009, seção 7/critério 12) — NUNCA a etiqueta
   * inteira.
   */
  regrasDesligadas: readonly string[] = [],
): Promise<void> {
  const construtor = new AxeBuilder({ page }).withTags(ETIQUETAS_DO_PORTAO);
  if (regrasDesligadas.length > 0) {
    construtor.disableRules([...regrasDesligadas]);
  }
  const resultado = await construtor.analyze();

  await info.attach(`axe-${nomeDaTela}`, {
    body: JSON.stringify(
      { violacoes: resultado.violations, indeterminado: resultado.incomplete },
      null,
      2,
    ),
    contentType: 'application/json',
  });

  const resumo = resultado.violations.map(
    (v) => `${v.id} (${v.impact ?? 'sem impacto'}): ${v.help} -> ${v.nodes[0]?.target.join(' ')}`,
  );
  expect(resumo, `Violacoes WCAG 2.2 AA + best-practice em "${nomeDaTela}"`).toEqual([]);
}
