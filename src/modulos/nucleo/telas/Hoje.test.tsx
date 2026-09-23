/**
 * `TelaHoje` (ADR 0009, seção 2/3, critério de aceite 6): sem estado, sem
 * efeito, sem leitura de banco — testável com `renderToStaticMarkup`
 * (`react-dom/server`), mesmo padrão de `AvisoDeAtualizacao.test.tsx`. Só a
 * MARCAÇÃO é coberta aqui; navegação, foco e rolagem reais são comportamento
 * de navegador e ficam para `e2e/hoje.spec.ts` (ADR 0009, seção 6).
 *
 * `MemoryRouter` (`react-router`) é necessário porque `TelaHoje` usa `<Link>`
 * nos atalhos de registro.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { textos } from '@/i18n';
import type { AtalhoDeRegistro, CartaoDeHoje } from '../tipos';
import { TelaHoje } from './Hoje';

const textosDaHoje = textos.nucleo.hoje;

function CartaoFake({ texto }: { readonly texto: string }) {
  return <p>{texto}</p>;
}

function cartaoFake(
  modulo: CartaoDeHoje['modulo'],
  ordem: number,
  titulo: string,
  texto: string,
): CartaoDeHoje {
  return {
    modulo,
    ordem,
    titulo,
    Componente: () => <CartaoFake texto={texto} />,
  };
}

function atalhoFake(
  modulo: AtalhoDeRegistro['modulo'],
  ordem: number,
  rotulo: string,
  destino: string,
): AtalhoDeRegistro {
  return { modulo, ordem, rotulo, destino };
}

function renderizar(
  cartoes: readonly CartaoDeHoje[],
  atalhos: readonly AtalhoDeRegistro[],
): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/']}>
      <TelaHoje cartoes={cartoes} atalhos={atalhos} />
    </MemoryRouter>,
  );
}

/** Isola o `<section>...</section>` que contém o `<h2>` com este texto exato. */
function extrairSecao(html: string, textoDoH2: string): string {
  const marcador = `<h2>${textoDoH2}</h2>`;
  const indiceH2 = html.indexOf(marcador);
  if (indiceH2 === -1) {
    throw new Error(`h2 "${textoDoH2}" não encontrado no HTML: ${html}`);
  }
  const inicioSecao = html.lastIndexOf('<section', indiceH2);
  const fimSecao = html.indexOf('</section>', indiceH2) + '</section>'.length;
  return html.slice(inicioSecao, fimSecao);
}

describe('TelaHoje (ADR 0009, critério 6)', () => {
  it('cartões fora de ordem saem ordenados por `ordem`, cada um numa <section> com o conteúdo do seu Componente, sem mutar a prop', () => {
    const cartoesForaDeOrdem: readonly CartaoDeHoje[] = [
      cartaoFake('treino', 3, 'Título C', 'conteúdo-c'),
      cartaoFake('financas', 1, 'Título A', 'conteúdo-a'),
      cartaoFake('estudos', 2, 'Título B', 'conteúdo-b'),
    ];
    const copiaOriginal = [...cartoesForaDeOrdem];

    const html = renderizar(cartoesForaDeOrdem, []);

    const indiceA = html.indexOf('>Título A<');
    const indiceB = html.indexOf('>Título B<');
    const indiceC = html.indexOf('>Título C<');
    expect(indiceA).toBeGreaterThan(-1);
    expect(indiceB).toBeGreaterThan(indiceA);
    expect(indiceC).toBeGreaterThan(indiceB);

    expect(extrairSecao(html, 'Título A')).toContain('<p>conteúdo-a</p>');
    expect(extrairSecao(html, 'Título B')).toContain('<p>conteúdo-b</p>');
    expect(extrairSecao(html, 'Título C')).toContain('<p>conteúdo-c</p>');

    // A prop original não foi mutada: mesma ordem e mesmos objetos de antes.
    expect(cartoesForaDeOrdem).toEqual(copiaOriginal);
    expect(cartoesForaDeOrdem.map((c) => c.ordem)).toEqual([3, 1, 2]);
  });

  it('existe exatamente um <main> e um <h1> com o texto de nucleo.hoje.titulo', () => {
    const html = renderizar([], []);

    const mains = html.match(/<main[ >]/gu) ?? [];
    expect(mains).toHaveLength(1);

    const h1s = [...html.matchAll(/<h1[^>]*>([^<]*)<\/h1>/gu)];
    expect(h1s).toHaveLength(1);
    expect(h1s[0]?.[1]).toBe(textosDaHoje.titulo);
  });

  it('atalhos: [] mostra o texto de estado vazio e nenhum <a> na área "Registrar agora"', () => {
    const html = renderizar([], []);

    const secaoDeRegistro = extrairSecao(html, textosDaHoje.registroRapido.titulo);
    expect(secaoDeRegistro).toContain(textosDaHoje.registroRapido.vazio);
    expect(secaoDeRegistro).not.toContain('<a ');
    expect(secaoDeRegistro).not.toContain('<ul');
  });

  it('dois atalhos fora de ordem aparecem como <a> ordenados por `ordem`, com href/rótulo certos, e o texto vazio some', () => {
    const atalhosForaDeOrdem: readonly AtalhoDeRegistro[] = [
      atalhoFake('estudos', 2, 'Sessão de foco', '/estudos/nova-sessao'),
      atalhoFake('financas', 1, 'Gasto', '/financas/novo-gasto'),
    ];
    const copiaOriginal = [...atalhosForaDeOrdem];

    const html = renderizar([], atalhosForaDeOrdem);
    const secaoDeRegistro = extrairSecao(html, textosDaHoje.registroRapido.titulo);

    expect(secaoDeRegistro).not.toContain(textosDaHoje.registroRapido.vazio);

    const links = [...secaoDeRegistro.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gu)];
    expect(links).toHaveLength(2);
    expect(links[0]?.[1]).toBe('/financas/novo-gasto');
    expect(links[0]?.[2]).toBe('Gasto');
    expect(links[1]?.[1]).toBe('/estudos/nova-sessao');
    expect(links[1]?.[2]).toBe('Sessão de foco');

    expect(atalhosForaDeOrdem).toEqual(copiaOriginal);
  });
});
