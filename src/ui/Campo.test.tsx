/**
 * `Campo` (ADR 0008, seção 4/8.1, critério de aceite 8): a prop `erro`
 * precisa ser 100% opcional — sem ela, o HTML é idêntico ao que a tela
 * `/dados` (item 0.6) já usa. Mesmo padrão de `AvisoDeAtualizacao.test.tsx`
 * (`renderToStaticMarkup`, sem `@testing-library/react`, pendência 14).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Campo } from './Campo';

describe('Campo', () => {
  it('sem a prop "erro": não tem aria-invalid nem role="alert" (HTML igual ao de antes)', () => {
    const html = renderToStaticMarkup(<Campo rotulo="Nome" />);

    expect(html).not.toContain('aria-invalid');
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('<label');
    expect(html).toContain('>Nome<');
    expect(html).toContain('<input');
  });

  it('sem a prop "erro", mas com "dica": tem a dica associada por aria-describedby, sem role="alert"', () => {
    const html = renderToStaticMarkup(<Campo rotulo="Nome" dica="Uma dica qualquer" />);

    expect(html).toContain('aria-describedby');
    expect(html).toContain('Uma dica qualquer');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('aria-invalid');
  });

  it('com erro="" (string vazia): role="alert" montado vazio, sem aria-invalid', () => {
    const html = renderToStaticMarkup(<Campo rotulo="Nome" erro="" />);

    expect(html).toContain('role="alert"');
    expect(html).not.toContain('aria-invalid');
    // O parágrafo do erro existe, mas sem texto dentro.
    expect(html).toMatch(/<p[^>]*role="alert"[^>]*><\/p>/u);
  });

  it('com erro="x": aria-invalid="true" e aria-describedby aponta para o id do erro', () => {
    const html = renderToStaticMarkup(<Campo rotulo="Nome" erro="x" />);

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/<p[^>]*role="alert"[^>]*>x<\/p>/u);

    const idDoErro = /id="([^"]+-erro)"/u.exec(html)?.[1];
    expect(idDoErro).toBeDefined();
    expect(html).toContain(`aria-describedby="${idDoErro}"`);
  });

  it('com erro="x" e "dica" juntos: aria-describedby lista os dois ids', () => {
    const html = renderToStaticMarkup(<Campo rotulo="Nome" dica="Uma dica" erro="x" />);

    const idDaDica = /id="([^"]+-dica)"/u.exec(html)?.[1];
    const idDoErro = /id="([^"]+-erro)"/u.exec(html)?.[1];
    expect(idDaDica).toBeDefined();
    expect(idDoErro).toBeDefined();
    expect(html).toContain(`aria-describedby="${idDaDica} ${idDoErro}"`);
  });
});
