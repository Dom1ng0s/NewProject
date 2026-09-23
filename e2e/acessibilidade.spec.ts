import type { Page } from '@playwright/test';
import { test } from './fixtures/base';
import { PaginaHoje } from './paginas/hoje';
import { PaginaDados } from './paginas/dados';
import { verificarAcessibilidade } from './utilitarios/acessibilidade';

// Uma linha por tela nova (ADR 0004, secao 5.2). Os itens 0.10/0.11 acrescentam
// o restante das telas reais.
const TELAS = [
  { nome: 'hoje', abrir: (page: Page) => new PaginaHoje(page).abrir() },
  { nome: 'dados', abrir: (page: Page) => new PaginaDados(page).abrir() }, // ADR 0006, critério 20
];

for (const tela of TELAS) {
  test(`sem violacao WCAG 2.2 AA: ${tela.nome}`, async ({ page }, info) => {
    await tela.abrir(page);
    await verificarAcessibilidade(page, info, tela.nome);
  });
}
