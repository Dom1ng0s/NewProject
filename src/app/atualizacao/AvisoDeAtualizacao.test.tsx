/**
 * `AvisoDeAtualizacao` (ADR 0007, seção 4 e critério de aceite 13): só
 * apresentação, sem `virtual:pwa-register/react` — por isso é testável com
 * `renderToStaticMarkup` (`react-dom/server`, sem dependência nova e sem
 * precisar do módulo virtual do plugin PWA, que só existe dentro do Vite). O
 * fluxo real (versão nova → aviso → recarga) não é automatizável (ADR 0007,
 * fato 3) e fica fora daqui, no roteiro manual do item 5.8.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { textos } from '@/i18n';
import { AvisoDeAtualizacao } from './AvisoDeAtualizacao';

const t = textos.comum.atualizacao;

function botoes(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>[^<]*<\/button>/gu)].map(
    (correspondencia) => correspondencia[0],
  );
}

describe('AvisoDeAtualizacao', () => {
  it('critério 13: role="status" e os textos de mensagem/dica aparecem no markup', () => {
    const html = renderToStaticMarkup(
      <AvisoDeAtualizacao
        aoAtualizar={() => undefined}
        aoDispensar={() => undefined}
        atualizando={false}
      />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain(t.mensagem);
    expect(html).toContain(t.dica);
  });

  it('critério 13: exatamente dois <button type="button">, "Atualizar agora" e "Depois"', () => {
    const html = renderToStaticMarkup(
      <AvisoDeAtualizacao
        aoAtualizar={() => undefined}
        aoDispensar={() => undefined}
        atualizando={false}
      />,
    );

    const listaDeBotoes = botoes(html);
    expect(listaDeBotoes).toHaveLength(2);
    for (const botao of listaDeBotoes) {
      expect(botao.startsWith('<button type="button"')).toBe(true);
    }
    expect(listaDeBotoes.some((botao) => botao.includes(`>${t.atualizarAgora}<`))).toBe(true);
    expect(listaDeBotoes.some((botao) => botao.includes(`>${t.depois}<`))).toBe(true);
  });

  it('critério 13: com atualizando=false, o botão principal tem aria-busy="false" e o texto "Atualizar agora"', () => {
    const html = renderToStaticMarkup(
      <AvisoDeAtualizacao
        aoAtualizar={() => undefined}
        aoDispensar={() => undefined}
        atualizando={false}
      />,
    );

    const [botaoPrincipal] = botoes(html).filter((botao) => botao.includes('aria-busy'));
    expect(botaoPrincipal).toContain('aria-busy="false"');
    expect(botaoPrincipal).toContain(`>${t.atualizarAgora}<`);
    expect(html).not.toContain(t.atualizando);
  });

  it('critério 13: com atualizando=true, o botão principal mostra "Atualizando..." com aria-busy="true"', () => {
    const html = renderToStaticMarkup(
      <AvisoDeAtualizacao
        aoAtualizar={() => undefined}
        aoDispensar={() => undefined}
        atualizando={true}
      />,
    );

    const [botaoPrincipal] = botoes(html).filter((botao) => botao.includes('aria-busy'));
    expect(botaoPrincipal).toContain('aria-busy="true"');
    expect(botaoPrincipal).toContain(`>${t.atualizando}<`);
    expect(botaoPrincipal).not.toContain(`>${t.atualizarAgora}<`);
  });
});
