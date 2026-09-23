import { useEffect } from 'react';

/**
 * Define `document.title` para a tela atual (WCAG 2.4.2, nível A). Cada tela
 * chama com o próprio título, inclusive a Hoje (com `NOME_DO_APP`) — sem
 * isso, voltar para a Hoje via navegação SPA deixaria o título preso no da
 * última tela visitada, já que o `<title>` estático de `index.html` só vale
 * na primeira carga. Ver ADR 0009, seção 1.
 */
export function useTituloDaPagina(titulo: string): void {
  useEffect(() => {
    document.title = titulo;
  }, [titulo]);
}
