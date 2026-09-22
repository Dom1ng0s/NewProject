import type { Page } from '@playwright/test';
import { test } from './fixtures/base';
import { PaginaHoje } from './paginas/hoje';
import { verificarAcessibilidade } from './utilitarios/acessibilidade';

// Uma linha por tela nova (ADR 0004, secao 5.2). Hoje so existe a casca vazia;
// os itens 0.10/0.11 acrescentam as telas reais.
const TELAS = [{ nome: 'hoje', abrir: (page: Page) => new PaginaHoje(page).abrir() }];

for (const tela of TELAS) {
  test(`sem violacao WCAG 2.2 AA: ${tela.nome}`, async ({ page }, info) => {
    await tela.abrir(page);
    await verificarAcessibilidade(page, info, tela.nome);
  });
}
