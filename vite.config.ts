import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// Caminho relativo: o alias "@" não vale dentro da configuração do Vite, e
// `src/i18n/**` precisa continuar só com constantes (sem React, sem DOM)
// para poder ser importado aqui (ADR 0007, seção 2).
import { NOME_DO_APP, DESCRICAO_DO_APP } from './src/i18n';

/**
 * Troca `%NOME_DO_APP%` e `%DESCRICAO_DO_APP%` pelos valores do i18n no
 * `index.html` servido/buildado. Evita texto fixo no HTML (ADR 0007, seção
 * 2). Sem dependência nova.
 */
function textosDoHtml(): Plugin {
  return {
    name: 'textos-do-html',
    transformIndexHtml(html) {
      return html
        .replaceAll('%NOME_DO_APP%', NOME_DO_APP)
        .replaceAll('%DESCRICAO_DO_APP%', DESCRICAO_DO_APP);
    },
  };
}

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    textosDoHtml(),
    VitePWA({
      registerType: 'prompt',
      // O registro do service worker passa a ser feito pelo hook
      // `useAtualizacaoDoApp` (ADR 0007, seção 4), não automaticamente.
      injectRegister: false,
      devOptions: { enabled: false },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      manifest: {
        id: '/',
        name: NOME_DO_APP,
        short_name: NOME_DO_APP,
        description: DESCRICAO_DO_APP,
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Sem `orientation`: travar a orientação descumpriria WCAG 2.2 AA
        // 1.3.4 (ADR 0007, seção 2).
        // As cores abaixo duplicam `--cor-fundo` (tema claro) de
        // `src/app/estilos/tokens.css` e as metas `theme-color` de
        // `index.html`: os três precisam mudar juntos.
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: '/icones/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icones/icone-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  build: { sourcemap: true },
  server: { port: 5173 },
  preview: { port: 4173 },
});
