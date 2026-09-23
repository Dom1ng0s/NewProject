import type { Locator, Page, Response } from '@playwright/test';
import { textos } from '@/i18n';
import { PaginaConfiguracoes } from './configuracoes';

const textosDeNavegacao = textos.comum.navegacao;
const textosDaHoje = textos.nucleo.hoje;

/**
 * Page object da tela Hoje (`/`, ADR 0009). A moldura só tem dois destinos
 * na `<nav>` (Hoje e Configurações, seção 1): não existe mais link direto
 * para `/dados` na Hoje — `navegarParaDados` passa por Configurações, do
 * mesmo jeito que o usuário faria de verdade.
 */
export class PaginaHoje {
  static readonly caminho = '/';

  readonly pagina: Page;
  /** `#root` inteiro: smoke test de "algo montou" (`app-carrega.spec.ts`, `pwa.spec.ts`). */
  readonly raiz: Locator;
  readonly titulo: Locator;
  readonly tituloDoRegistroRapido: Locator;
  readonly textoDeRegistroVazio: Locator;
  readonly listaDeAtalhos: Locator;
  readonly linkDeNavegacaoHoje: Locator;
  readonly linkDeNavegacaoConfiguracoes: Locator;

  constructor(page: Page) {
    this.pagina = page;
    this.raiz = page.locator('#root');
    this.titulo = page.getByRole('heading', { level: 1, name: textosDaHoje.titulo, exact: true });
    this.tituloDoRegistroRapido = page.getByRole('heading', {
      level: 2,
      name: textosDaHoje.registroRapido.titulo,
    });
    this.textoDeRegistroVazio = page.getByText(textosDaHoje.registroRapido.vazio);
    this.listaDeAtalhos = page.getByRole('list').filter({ has: page.getByRole('link') });

    const navegacaoPrincipal = page.getByRole('navigation', { name: textosDeNavegacao.rotulo });
    this.linkDeNavegacaoHoje = navegacaoPrincipal.getByRole('link', {
      name: textosDeNavegacao.hoje,
    });
    this.linkDeNavegacaoConfiguracoes = navegacaoPrincipal.getByRole('link', {
      name: textosDeNavegacao.configuracoes,
    });
  }

  async abrir(): Promise<Response> {
    const resposta = await this.pagina.goto(PaginaHoje.caminho);
    if (!resposta) {
      throw new Error('Navegar para a tela Hoje nao retornou resposta HTTP.');
    }
    await this.titulo.waitFor({ state: 'visible' });
    return resposta;
  }

  /** `<h2>` que a Hoje desenha para o cartão de um módulo (ADR 0009, seção 3). */
  tituloDoCartao(titulo: string): Locator {
    return this.pagina.getByRole('heading', { level: 2, name: titulo, exact: true });
  }

  async navegarParaConfiguracoes(): Promise<void> {
    await this.linkDeNavegacaoConfiguracoes.click();
  }

  /**
   * Não existe mais link direto Hoje → Dados (ADR 0009, seção 1): a Hoje só
   * navega para Configurações, e é o link "Backup, exportar e apagar dados"
   * de lá que leva a `/dados`. Três toques (Hoje → Configurações → Dados) é
   * aceitável para uma ação rara.
   */
  async navegarParaDados(): Promise<void> {
    await this.navegarParaConfiguracoes();
    const configuracoes = new PaginaConfiguracoes(this.pagina);
    await configuracoes.titulo.waitFor({ state: 'visible' });
    await configuracoes.linkParaDados.click();
  }
}
