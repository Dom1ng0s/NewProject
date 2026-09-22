import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

/**
 * WCAG 2.2 AA (especificacao, secao 9). As etiquetas do axe NAO sao cumulativas:
 * `wcag22aa` nao contem `wcag2a`. Por isso as cinco precisam estar na lista.
 * `best-practice` fica de fora de proposito (ver ADR 0004, "Alternativas").
 */
export const ETIQUETAS_WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export async function verificarAcessibilidade(
  page: Page,
  info: TestInfo,
  nomeDaTela: string,
): Promise<void> {
  const resultado = await new AxeBuilder({ page }).withTags(ETIQUETAS_WCAG_AA).analyze();

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
  expect(resumo, `Violacoes WCAG 2.2 AA em "${nomeDaTela}"`).toEqual([]);
}
