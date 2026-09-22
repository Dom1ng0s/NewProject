import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    // Data de calendário (`dataDeCalendarioDe`) depende do fuso do processo;
    // fixo para não depender da máquina que roda os testes (ADR 0005).
    env: { TZ: 'America/Sao_Paulo' },
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['src/**/dominio/**', 'src/persistencia/**'],
    },
  },
});
