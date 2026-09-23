import type { Locator, Page, Response } from '@playwright/test';
import { textos } from '@/i18n';

const t = textos.nucleo.configuracoes;

/**
 * Page object da tela `/configuracoes` (ADR 0008, seção 2/8.1). Os campos de
 * texto (foco, treinos, orçamento) usam `Campo` (rótulo associado via
 * `<label for>`, erro em `role="alert"` sempre montado dentro do mesmo
 * `.campo`); os rádios (unidade de peso, tema) usam `GrupoDeOpcoes`
 * (`<label>` inteiro como alvo de toque, envolvendo o `<input type="radio">`).
 */
export class PaginaConfiguracoes {
  static readonly caminho = '/configuracoes';

  readonly pagina: Page;
  readonly titulo: Locator;
  readonly status: Locator;

  readonly campoFoco: Locator;
  readonly campoTreinos: Locator;
  readonly campoOrcamento: Locator;

  readonly radioKg: Locator;
  readonly radioLb: Locator;
  readonly radioSistema: Locator;
  readonly radioClaro: Locator;
  readonly radioEscuro: Locator;

  readonly linkParaDados: Locator;

  constructor(page: Page) {
    this.pagina = page;
    this.titulo = page.getByRole('heading', { level: 1, name: t.titulo });
    this.status = page.getByRole('status');

    this.campoFoco = page.getByLabel(t.metas.rotuloFoco);
    this.campoTreinos = page.getByLabel(t.metas.rotuloTreinos);
    this.campoOrcamento = page.getByLabel(t.orcamento.rotulo);

    this.radioKg = page.getByRole('radio', { name: t.unidades.kg });
    this.radioLb = page.getByRole('radio', { name: t.unidades.lb });
    this.radioSistema = page.getByRole('radio', { name: t.aparencia.sistema });
    this.radioClaro = page.getByRole('radio', { name: t.aparencia.claro });
    this.radioEscuro = page.getByRole('radio', { name: t.aparencia.escuro });

    this.linkParaDados = page.getByRole('link', { name: t.dados.link });
  }

  async abrir(): Promise<Response> {
    const resposta = await this.pagina.goto(PaginaConfiguracoes.caminho);
    if (!resposta) {
      throw new Error('Navegar para /configuracoes nao retornou resposta HTTP.');
    }
    await this.titulo.waitFor({ state: 'visible' });
    return resposta;
  }

  /** O `role="alert"` do MESMO `.campo` que envolve o campo dado (ADR 0008, seção 4/8.1). */
  erroDoCampo(campo: Locator): Locator {
    return this.pagina.locator('.campo', { has: campo }).getByRole('alert');
  }

  get erroFoco(): Locator {
    return this.erroDoCampo(this.campoFoco);
  }

  get erroTreinos(): Locator {
    return this.erroDoCampo(this.campoTreinos);
  }

  get erroOrcamento(): Locator {
    return this.erroDoCampo(this.campoOrcamento);
  }

  /** O `<label>` inteiro (alvo de toque) que envolve o rádio dado. */
  rotuloDoRadio(radio: Locator): Locator {
    return radio.locator('xpath=..');
  }

  /** Confirma um campo de texto focado, do jeito que o usuário confirmaria: `Tab` para o próximo controle. */
  async confirmarComTab(): Promise<void> {
    await this.pagina.keyboard.press('Tab');
  }
}
