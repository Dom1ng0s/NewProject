import { NOME_DO_APP } from '@/i18n';
import { test, expect } from './fixtures/base';
import { PaginaHoje } from './paginas/hoje';

// Teste de fumaca (ADR 0004, secao 4.2): substitui e2e/placeholder.spec.ts.
// Prova que o app builda, sobe, carrega e monta nos dois projetos, sem erro.
test('o app carrega e monta na tela Hoje', async ({ page }) => {
  const hoje = new PaginaHoje(page);
  const resposta = await hoje.abrir();

  expect(resposta.status()).toBeLessThan(400);
  await expect(hoje.raiz).not.toBeEmpty();
  await expect(page).toHaveTitle(NOME_DO_APP);
});
