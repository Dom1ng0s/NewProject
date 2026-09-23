import type { Locator, Page, Response } from '@playwright/test';
import { textos } from '@/i18n';

/**
 * Page object minimo da tela Hoje. O item 0.11 acrescenta os cartoes de cada
 * pilar e os atalhos de registro; hoje o app so renderiza a casca
 * (`<p>Hoje <a>Dados</a> <a>Configurações</a></p>` dentro de `#root`, ADR
 * 0006 secao 7 / ADR 0008 secao 9), com os links para `/dados` e
 * `/configuracoes` usados pelo e2e do backup e de configuracoes.
 */
export class PaginaHoje {
  static readonly caminho = '/';

  readonly pagina: Page;
  readonly raiz: Locator;
  readonly linkParaDados: Locator;
  readonly linkParaConfiguracoes: Locator;

  constructor(page: Page) {
    this.pagina = page;
    this.raiz = page.locator('#root');
    this.linkParaDados = page.getByRole('link', { name: textos.nucleo.hoje.linkParaDados });
    this.linkParaConfiguracoes = page.getByRole('link', {
      name: textos.nucleo.hoje.linkParaConfiguracoes,
    });
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

  async navegarParaConfiguracoes(): Promise<void> {
    await this.linkParaConfiguracoes.click();
  }
}
