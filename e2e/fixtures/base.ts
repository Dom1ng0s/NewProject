import { test as base, expect } from '@playwright/test';

interface Fixtures {
  /** Erros de console tolerados no arquivo, via `test.use({...})`. Vazio = nenhum. */
  errosDeConsoleEsperados: RegExp[];
  guardaDeConsole: void;
}

export const test = base.extend<Fixtures>({
  errosDeConsoleEsperados: [[], { option: true }],

  // Automatica: vale para todo teste que importar este `test`.
  guardaDeConsole: [
    async ({ page, errosDeConsoleEsperados }, use) => {
      const erros: string[] = [];
      const tolerado = (texto: string) =>
        errosDeConsoleEsperados.some((padrao) => padrao.test(texto));

      page.on('console', (mensagem) => {
        if (mensagem.type() === 'error' && !tolerado(mensagem.text())) {
          erros.push(`console.error: ${mensagem.text()}`);
        }
      });
      page.on('pageerror', (erro) => {
        if (!tolerado(erro.message)) erros.push(`pageerror: ${erro.message}`);
      });

      await use();

      expect(erros, 'A pagina nao pode registrar erro de console nem excecao nao tratada').toEqual(
        [],
      );
    },
    { auto: true },
  ],
});

export { expect };
