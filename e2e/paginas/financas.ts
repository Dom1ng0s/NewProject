import type { Locator, Page, Response } from '@playwright/test';
import { textos } from '@/i18n';

const tPagina = textos.financas.pagina;
const tNovo = textos.financas.novoLancamento;
const tEditar = textos.financas.editar;
const tCategorias = textos.financas.categorias;

/** Page object da tela `/financas` (item 1.1/1.2/1.6 do plano). */
export class PaginaFinancas {
  static readonly caminho = '/financas';

  readonly pagina: Page;
  readonly titulo: Locator;
  readonly linkNovoGasto: Locator;
  readonly linkNovaEntrada: Locator;
  readonly linkCategorias: Locator;
  readonly linkDefinirOrcamento: Locator;
  readonly listaDeLancamentos: Locator;

  constructor(page: Page) {
    this.pagina = page;
    this.titulo = page.getByRole('heading', { level: 1, name: tPagina.titulo, exact: true });
    this.linkNovoGasto = page.getByRole('link', { name: tPagina.botaoNovoGasto });
    this.linkNovaEntrada = page.getByRole('link', { name: tPagina.botaoNovaEntrada });
    this.linkCategorias = page.getByRole('link', { name: tPagina.linkCategorias });
    this.linkDefinirOrcamento = page.getByRole('link', { name: tPagina.linkDefinirOrcamento });
    this.listaDeLancamentos = page.getByRole('listitem');
  }

  async abrir(): Promise<Response> {
    const resposta = await this.pagina.goto(PaginaFinancas.caminho);
    if (!resposta) throw new Error('Navegar para /financas nao retornou resposta HTTP.');
    await this.titulo.waitFor({ state: 'visible' });
    return resposta;
  }

  /** Link "Editar ..." de um lançamento que contenha `textoParcial` no nome acessível. */
  linkEditarDoLancamento(textoParcial: string | RegExp): Locator {
    return this.pagina.getByRole('link', {
      name: new RegExp(`^Editar .*${String(textoParcial)}`, 'u'),
    });
  }
}

/** Page object da tela `/financas/novo-lancamento` (gasto em 3 toques). */
export class PaginaNovoLancamento {
  static readonly caminho = '/financas/novo-lancamento';

  readonly pagina: Page;
  readonly tituloGasto: Locator;
  readonly tituloEntrada: Locator;
  readonly campoValor: Locator;
  readonly campoDescricao: Locator;
  readonly campoData: Locator;
  readonly radioGasto: Locator;
  readonly radioEntrada: Locator;

  constructor(page: Page) {
    this.pagina = page;
    this.tituloGasto = page.getByRole('heading', { level: 1, name: tNovo.tituloGasto });
    this.tituloEntrada = page.getByRole('heading', { level: 1, name: tNovo.tituloEntrada });
    this.campoValor = page.getByLabel(tNovo.rotuloValor);
    this.campoDescricao = page.getByLabel(tNovo.rotuloDescricao);
    this.campoData = page.getByLabel(tNovo.rotuloData);
    this.radioGasto = page.getByRole('radio', { name: tNovo.opcaoGasto });
    this.radioEntrada = page.getByRole('radio', { name: tNovo.opcaoEntrada });
  }

  /** Botão de categoria pelo nome (tocar salva, ADR/pendência 5 do plano). */
  categoria(nome: string): Locator {
    return this.pagina.getByRole('button', { name: nome, exact: true });
  }
}

/** Page object da tela `/financas/lancamentos/:id/editar`. */
export class PaginaEditarLancamento {
  readonly pagina: Page;
  readonly titulo: Locator;
  readonly campoValor: Locator;
  readonly botaoSalvar: Locator;
  readonly botaoExcluir: Locator;

  constructor(page: Page) {
    this.pagina = page;
    this.titulo = page.getByRole('heading', { level: 1, name: tEditar.titulo });
    this.campoValor = page.getByLabel(tEditar.rotuloValor);
    this.botaoSalvar = page.getByRole('button', { name: tEditar.botaoSalvar });
    this.botaoExcluir = page.getByRole('button', { name: tEditar.botaoExcluir });
  }
}

/** Page object da tela `/financas/categorias`. */
export class PaginaCategorias {
  static readonly caminho = '/financas/categorias';

  readonly pagina: Page;
  readonly titulo: Locator;
  readonly campoNovaCategoria: Locator;
  readonly botaoAdicionar: Locator;

  constructor(page: Page) {
    this.pagina = page;
    this.titulo = page.getByRole('heading', { level: 1, name: tCategorias.titulo });
    this.campoNovaCategoria = page.getByLabel(tCategorias.rotuloNovaCategoria).first();
    this.botaoAdicionar = page.getByRole('button', { name: tCategorias.botaoAdicionar });
  }

  async abrir(): Promise<Response> {
    const resposta = await this.pagina.goto(PaginaCategorias.caminho);
    if (!resposta) throw new Error('Navegar para /financas/categorias nao retornou resposta HTTP.');
    await this.titulo.waitFor({ state: 'visible' });
    return resposta;
  }
}
