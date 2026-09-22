import type { Locator, Page, Response } from '@playwright/test';

/**
 * Page object minimo da tela Hoje. O item 0.11 acrescenta os locators reais
 * da tela (cartoes de cada pilar, atalhos de registro) quando ela existir;
 * hoje o app so renderiza a casca (`<p>Hoje</p>` dentro de `#root`).
 */
export class PaginaHoje {
  static readonly caminho = '/';

  readonly pagina: Page;
  readonly raiz: Locator;

  constructor(page: Page) {
    this.pagina = page;
    this.raiz = page.locator('#root');
  }

  async abrir(): Promise<Response> {
    const resposta = await this.pagina.goto(PaginaHoje.caminho);
    if (!resposta) {
      throw new Error('Navegar para a tela Hoje nao retornou resposta HTTP.');
    }
    await this.raiz.waitFor({ state: 'attached' });
    return resposta;
  }
}
