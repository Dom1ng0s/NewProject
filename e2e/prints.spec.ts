import type { Page } from '@playwright/test';
import { test } from './fixtures/base';
import { PaginaConfiguracoes } from './paginas/configuracoes';
import { PaginaDados } from './paginas/dados';
import { PaginaHoje } from './paginas/hoje';

/**
 * Prints de fase (D6, ADR 0010). Roda só por `npm run test:e2e:prints`;
 * `npm run test:e2e` exclui os títulos com `@prints`. Atualize `FASE` e a
 * lista `PRINTS` no fim de cada fase. A Hoje é sempre a primeira.
 */
const FASE = 0;

interface Print {
  arquivo: string;
  escuro?: boolean;
  abrir: (page: Page) => Promise<unknown>;
}

const PRINTS: Print[] = [
  { arquivo: 'hoje', abrir: (page) => new PaginaHoje(page).abrir() },
  { arquivo: 'hoje-escuro', escuro: true, abrir: (page) => new PaginaHoje(page).abrir() },
  { arquivo: 'configuracoes', abrir: (page) => new PaginaConfiguracoes(page).abrir() },
  { arquivo: 'dados', abrir: (page) => new PaginaDados(page).abrir() },
];

test.skip(({ browserName }) => browserName !== 'webkit', 'Prints (D6) só em iPhone emulado');

for (const print of PRINTS) {
  test.describe(() => {
    test.use({ colorScheme: print.escuro ? 'dark' : 'light' });

    test(`print ${print.arquivo} @prints`, async ({ page }) => {
      await print.abrir(page);
      await page.screenshot({
        path: `docs/prints/fase-${FASE}/${print.arquivo}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    });
  });
}
