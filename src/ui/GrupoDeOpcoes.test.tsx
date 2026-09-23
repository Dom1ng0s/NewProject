/**
 * `GrupoDeOpcoes` (ADR 0008, seção 8.1, critério de aceite 8): rádios
 * nativos em `<fieldset>`/`<legend>`, mesmo `name`, só a opção do `valor`
 * marcada. Mesmo padrão de `AvisoDeAtualizacao.test.tsx`
 * (`renderToStaticMarkup`, sem `@testing-library/react`, pendência 14).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GrupoDeOpcoes } from './GrupoDeOpcoes';

const OPCOES = [
  { valor: 'kg', rotulo: 'Quilogramas (kg)' },
  { valor: 'lb', rotulo: 'Libras (lb)' },
] as const;

function radios(html: string): string[] {
  return [...html.matchAll(/<input[^>]*type="radio"[^>]*>/gu)].map((m) => m[0]);
}

describe('GrupoDeOpcoes', () => {
  it('renderiza <fieldset> e <legend> com a legenda', () => {
    const html = renderToStaticMarkup(
      <GrupoDeOpcoes
        legenda="Unidade de peso"
        opcoes={OPCOES}
        valor="kg"
        aoMudar={() => undefined}
      />,
    );

    expect(html).toContain('<fieldset');
    expect(html).toMatch(/<legend[^>]*>Unidade de peso<\/legend>/u);
  });

  it('renderiza um <input type="radio"> por opção, dentro do seu <label>, com o rótulo visível', () => {
    const html = renderToStaticMarkup(
      <GrupoDeOpcoes
        legenda="Unidade de peso"
        opcoes={OPCOES}
        valor="kg"
        aoMudar={() => undefined}
      />,
    );

    const listaDeRadios = radios(html);
    expect(listaDeRadios).toHaveLength(2);

    // Cada rádio está dentro de um <label>, e o texto do rótulo aparece logo
    // depois dele (renderToStaticMarkup não fecha o <input> com barra).
    expect(html).toMatch(
      /<label[^>]*><input[^>]*type="radio"[^>]*\/?>Quilogramas \(kg\)<\/label>/u,
    );
    expect(html).toMatch(/<label[^>]*><input[^>]*type="radio"[^>]*\/?>Libras \(lb\)<\/label>/u);
  });

  it('todos os rádios compartilham o mesmo "name"', () => {
    const html = renderToStaticMarkup(
      <GrupoDeOpcoes
        legenda="Unidade de peso"
        opcoes={OPCOES}
        valor="kg"
        aoMudar={() => undefined}
      />,
    );

    const nomes = radios(html).map((radio) => /name="([^"]+)"/u.exec(radio)?.[1]);
    expect(nomes).toHaveLength(2);
    expect(new Set(nomes).size).toBe(1);
    expect(nomes[0]).toBeDefined();
  });

  it('só o rádio da opção "valor" tem "checked"', () => {
    const html = renderToStaticMarkup(
      <GrupoDeOpcoes
        legenda="Unidade de peso"
        opcoes={OPCOES}
        valor="lb"
        aoMudar={() => undefined}
      />,
    );

    const listaDeRadios = radios(html);
    const marcados = listaDeRadios.filter((radio) => radio.includes('checked'));
    expect(marcados).toHaveLength(1);
    expect(marcados[0]).toContain('value="lb"');

    const naoMarcado = listaDeRadios.find((radio) => radio.includes('value="kg"'));
    expect(naoMarcado).toBeDefined();
    expect(naoMarcado).not.toContain('checked');
  });

  it('sem "dica": não monta parágrafo de dica nem aria-describedby no fieldset', () => {
    const html = renderToStaticMarkup(
      <GrupoDeOpcoes
        legenda="Unidade de peso"
        opcoes={OPCOES}
        valor="kg"
        aoMudar={() => undefined}
      />,
    );

    expect(html).not.toContain('aria-describedby');
  });

  it('com "dica": o fieldset referencia a dica por aria-describedby', () => {
    const html = renderToStaticMarkup(
      <GrupoDeOpcoes
        legenda="Unidade de peso"
        opcoes={OPCOES}
        valor="kg"
        aoMudar={() => undefined}
        dica="Muda só a exibição."
      />,
    );

    const idDaDica = /id="([^"]+-dica)"/u.exec(html)?.[1];
    expect(idDaDica).toBeDefined();
    expect(html).toContain(`aria-describedby="${idDaDica}"`);
    expect(html).toContain('Muda só a exibição.');
  });
});
