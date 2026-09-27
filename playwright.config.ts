import { defineConfig, devices } from '@playwright/test';

const PORTA = 4173;
const BASE_URL = `http://localhost:${PORTA}`;
// `noPropertyAccessFromIndexSignature` (tsconfig) exige colchetes para ler de `process.env`.
const CI = process.env['CI'];

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: Boolean(CI),
  retries: CI ? 2 : 0,
  // `exactOptionalPropertyTypes` proíbe atribuir `undefined` a uma prop opcional:
  // a prop precisa ficar ausente fora do CI, não presente com valor `undefined`.
  ...(CI ? { workers: 1 } : {}),
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Decisão D13: o alvo real é o iPhone, então a suíte roda em WebKit.
    // O Chromium fica só para o que o protocolo do WebKit não permite
    // verificar (offline, instalabilidade, cache do service worker),
    // marcado com @chromium — antes ele repetia a suíte inteira à toa.
    { name: 'iphone-webkit', use: { ...devices['iPhone 15'] } },
    { name: 'android-chromium', use: { ...devices['Pixel 7'] }, grep: /@chromium/ },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
