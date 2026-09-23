import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/base';
import { PaginaHoje } from './paginas/hoje';
import { PaginaDados } from './paginas/dados';
import { PaginaConfiguracoes } from './paginas/configuracoes';
import { verificarAcessibilidade } from './utilitarios/acessibilidade';

// Uma linha por tela nova (ADR 0004, secao 5.2). O item 0.11 acrescenta o
// restante das telas reais.
const TELAS = [
  { nome: 'hoje', abrir: (page: Page) => new PaginaHoje(page).abrir() },
  { nome: 'dados', abrir: (page: Page) => new PaginaDados(page).abrir() }, // ADR 0006, critério 20
  // Tema claro (padrão do dispositivo emulado, sem `colorScheme` explícito):
  // ADR 0008, critério 16.
  {
    nome: 'configuracoes-tema-claro',
    abrir: (page: Page) => new PaginaConfiguracoes(page).abrir(),
  },
];

for (const tela of TELAS) {
  test(`sem violacao WCAG 2.2 AA: ${tela.nome}`, async ({ page }, info) => {
    await tela.abrir(page);
    await verificarAcessibilidade(page, info, tela.nome);
  });
}

// Tema escuro (ADR 0008, seção 11, critério 16): o axe passa a auditar o
// tema escuro pela primeira vez. Precisa do sistema emulado como escuro
// (`colorScheme: 'dark'`) ANTES de navegar, para o tema resolvido já nascer
// escuro (`tema: 'sistema'` é o padrão, ADR 0008 D11).
test.describe('configuracoes, tema escuro', () => {
  test.use({ colorScheme: 'dark' });

  test('sem violacao WCAG 2.2 AA: configuracoes-tema-escuro', async ({ page }, info) => {
    const config = new PaginaConfiguracoes(page);
    await config.abrir();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');

    await verificarAcessibilidade(page, info, 'configuracoes-tema-escuro');
  });
});
