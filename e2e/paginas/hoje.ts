import type { Locator, Page, Response } from '@playwright/test';
import { textos } from '@/i18n';

/**
 * Page object minimo da tela Hoje. O item 0.11 acrescenta os cartoes de cada
 * pilar e os atalhos de registro; hoje o app so renderiza a casca
 * (`<p>Hoje <a>Dados</a></p>` dentro de `#root`, ADR 0006 secao 7), com o
 * link para `/dados` usado pelo e2e do backup (critério de aceite 18).
 */
export class PaginaHoje {
  static readonly caminho = '/';

  readonly pagina: Page;
  readonly raiz: Locator;
  readonly linkParaDados: Locator;

  constructor(page: Page) {
    this.pagina = page;
    this.raiz = page.locator('#root');
    this.linkParaDados = page.getByRole('link', { name: textos.nucleo.hoje.linkParaDados });
  }

  async abrir(): Promise<Response> {
    const resposta = await this.pagina.goto(PaginaHoje.caminho);
    if (!resposta) {
      throw new Error('Navegar para a tela Hoje nao retornou resposta HTTP.');
    }
    await this.raiz.waitFor({ state: 'attached' });
    return resposta;
  }

  async navegarParaDados(): Promise<void> {
    await this.linkParaDados.click();
  }
}
