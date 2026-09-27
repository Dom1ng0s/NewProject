import type { Locator, Page } from '@playwright/test';
import { textos } from '@/i18n';
import { test, expect } from './fixtures/base';
import { PaginaHoje } from './paginas/hoje';
import { PaginaDados } from './paginas/dados';
import { PaginaConfiguracoes } from './paginas/configuracoes';
import { PaginaCategorias, PaginaFinancas, PaginaNovoLancamento } from './paginas/financas';
import { verificarAcessibilidade } from './utilitarios/acessibilidade';

const textosDeNavegacao = textos.comum.navegacao;

// Uma linha por tela nova (ADR 0004, secao 5.2; ADR 0009, critério 12). Tema
// claro (padrão do dispositivo emulado, sem `colorScheme` explícito).
const TELAS = [
  { nome: 'hoje', abrir: (page: Page) => new PaginaHoje(page).abrir() },
  { nome: 'dados', abrir: (page: Page) => new PaginaDados(page).abrir() }, // ADR 0006, critério 20
  // ADR 0008, critério 16.
  {
    nome: 'configuracoes-tema-claro',
    abrir: (page: Page) => new PaginaConfiguracoes(page).abrir(),
  },
  // Item 1.1/1.2/1.6 (Fase 1, Finanças): telas novas (pendência 68).
  { nome: 'financas', abrir: (page: Page) => new PaginaFinancas(page).abrir() },
  {
    nome: 'financas-novo-lancamento',
    abrir: async (page: Page) => {
      await page.goto(PaginaNovoLancamento.caminho);
      await new PaginaNovoLancamento(page).tituloGasto.waitFor({ state: 'visible' });
    },
  },
  { nome: 'financas-categorias', abrir: (page: Page) => new PaginaCategorias(page).abrir() },
];

for (const tela of TELAS) {
  test(`sem violacao WCAG 2.2 AA + best-practice: ${tela.nome}`, async ({ page }, info) => {
    await tela.abrir(page);
    await verificarAcessibilidade(page, info, tela.nome);
  });
}

// Tema escuro (ADR 0008, seção 11, critério 16; ADR 0009, critério 12: a
// Hoje passa a ser auditada nos dois temas, como Configurações). Precisa do
// sistema emulado como escuro (`colorScheme: 'dark'`) ANTES de navegar, para
// o tema resolvido já nascer escuro (`tema: 'sistema'` é o padrão, ADR 0008 D11).
test.describe('tema escuro (ADR 0009, critério 12)', () => {
  test.use({ colorScheme: 'dark' });

  test('sem violacao WCAG 2.2 AA + best-practice: hoje-tema-escuro', async ({ page }, info) => {
    const hoje = new PaginaHoje(page);
    await hoje.abrir();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');

    await verificarAcessibilidade(page, info, 'hoje-tema-escuro');
  });

  test('sem violacao WCAG 2.2 AA + best-practice: configuracoes-tema-escuro', async ({
    page,
  }, info) => {
    const config = new PaginaConfiguracoes(page);
    await config.abrir();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');

    await verificarAcessibilidade(page, info, 'configuracoes-tema-escuro');
  });
});

// ADR 0009, critério 12: navegação da Hoje só com teclado, e alvo de toque
// dos dois links da `<nav>` da moldura.
test.describe('navegação da moldura só por teclado (ADR 0009, critério 12)', () => {
  test('Tab a partir do topo passa por "Hoje" e "Configurações" na <nav>; Enter em "Configurações" abre a tela', async ({
    page,
  }) => {
    const hoje = new PaginaHoje(page);
    await hoje.abrir();

    // No primeiro carregamento o foco começa no <body> (critério 9): o
    // primeiro Tab precisa alcançar o link "Hoje", o primeiro elemento
    // focável da página.
    await page.keyboard.press('Tab');
    await expect(hoje.linkDeNavegacaoHoje).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(hoje.linkDeNavegacaoConfiguracoes).toBeFocused();

    await page.keyboard.press('Enter');

    const config = new PaginaConfiguracoes(page);
    await expect(config.titulo).toBeVisible();
    await expect(page).toHaveURL(/\/configuracoes$/);
  });

  test('os dois links da <nav> têm caixa de pelo menos 44×44px', async ({ page }) => {
    const hoje = new PaginaHoje(page);
    await hoje.abrir();

    async function medir(nome: string, alvo: Locator): Promise<void> {
      const caixa = await alvo.boundingBox();
      if (!caixa) throw new Error(`"${nome}" não tem bounding box (não está visível?).`);
      expect(caixa.width, `${nome}: largura`).toBeGreaterThanOrEqual(44);
      expect(caixa.height, `${nome}: altura`).toBeGreaterThanOrEqual(44);
    }

    await medir(textosDeNavegacao.hoje, hoje.linkDeNavegacaoHoje);
    await medir(textosDeNavegacao.configuracoes, hoje.linkDeNavegacaoConfiguracoes);
  });
});
