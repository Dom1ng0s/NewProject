/**
 * E2e da tela Hoje e da moldura/navegação mínima (ADR 0009, seção 11,
 * critérios 7-10). Os critérios de acessibilidade (12) ficam em
 * `e2e/acessibilidade.spec.ts`; o critério 11 (aviso de atualização ausente
 * à toa) é coberto em `e2e/pwa.spec.ts` (critério 12 do ADR 0007, que este
 * item só reposiciona). Nenhum teste aqui depende do dia em que a suíte
 * roda: a Hoje não mostra data (ADR 0009, seção 2, "Sem saudação e sem data").
 */
import { NOME_DO_APP, textos } from '@/i18n';
import { test, expect } from './fixtures/base';
import { PaginaHoje } from './paginas/hoje';
import { PaginaConfiguracoes } from './paginas/configuracoes';
import { PaginaDados } from './paginas/dados';

const textosDaHoje = textos.nucleo.hoje;

test.describe('layout da Hoje (critério 7)', () => {
  test('h1 "Hoje", "Registrar agora" com o texto de estado vazio, e os 4 cartões dos pilares na ordem Finanças/Estudos/Treino/Seu progresso, cada um com "Em breve"', async ({
    page,
  }) => {
    const hoje = new PaginaHoje(page);
    await hoje.abrir();

    await expect(hoje.titulo).toBeVisible();
    await expect(hoje.tituloDoRegistroRapido).toBeVisible();
    await expect(hoje.textoDeRegistroVazio).toBeVisible();

    // Ordem no DOM: "Registrar agora" primeiro (seção 2), depois os 4
    // cartões na ordem Finanças, Estudos, Treino, Seu progresso (seção 3.2).
    const titulosDosH2 = await page.getByRole('heading', { level: 2 }).allTextContents();
    expect(titulosDosH2).toEqual([
      textosDaHoje.registroRapido.titulo,
      textos.financas.hoje.tituloDoCartao,
      textos.estudos.hoje.tituloDoCartao,
      textos.treino.hoje.tituloDoCartao,
      textosDaHoje.tituloDoCartao,
    ]);

    await expect(page.getByText(textos.financas.hoje.emBreve)).toBeVisible();
    await expect(page.getByText(textos.estudos.hoje.emBreve)).toBeVisible();
    await expect(page.getByText(textos.treino.hoje.emBreve)).toBeVisible();
    await expect(page.getByText(textosDaHoje.emBreve)).toBeVisible();
  });

  test('em 360×640, a seção "Registrar agora" cabe inteira na primeira tela, sem rolar', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    const hoje = new PaginaHoje(page);
    await hoje.abrir();

    const posicaoDeRolagem = await page.evaluate(() => window.scrollY);
    expect(posicaoDeRolagem).toBe(0);

    const caixa = await hoje.tituloDoRegistroRapido.boundingBox();
    if (!caixa) throw new Error('"Registrar agora" não tem bounding box (não está visível?).');
    expect(caixa.y).toBeGreaterThanOrEqual(0);
    expect(caixa.y + caixa.height).toBeLessThanOrEqual(640);
  });
});

test.describe('navegação de ida e volta, só por toque em link (critério 8)', () => {
  test('Hoje → Configurações → Dados → Hoje → Configurações → Hoje, com aria-current e document.title certos em cada passo', async ({
    page,
  }) => {
    const hoje = new PaginaHoje(page);
    const config = new PaginaConfiguracoes(page);
    const dados = new PaginaDados(page);

    await test.step('Hoje (1º carregamento)', async () => {
      await hoje.abrir();
      await expect(page).toHaveTitle(NOME_DO_APP);
      await expect(hoje.linkDeNavegacaoHoje).toHaveAttribute('aria-current', 'page');
      await expect(hoje.linkDeNavegacaoConfiguracoes).not.toHaveAttribute('aria-current', 'page');
    });

    await test.step('Hoje → Configurações (pela <nav>)', async () => {
      await hoje.navegarParaConfiguracoes();
      await expect(config.titulo).toBeVisible();
      await expect(page).toHaveTitle(textos.comum.tituloDaPagina('Configurações'));
      await expect(hoje.linkDeNavegacaoConfiguracoes).toHaveAttribute('aria-current', 'page');
      await expect(hoje.linkDeNavegacaoHoje).not.toHaveAttribute('aria-current', 'page');
    });

    await test.step('Configurações → Dados (pelo link de Configurações)', async () => {
      await config.linkParaDados.click();
      await expect(dados.titulo).toBeVisible();
      await expect(page).toHaveTitle(textos.comum.tituloDaPagina('Dados'));
      // /dados não está na <nav>: nenhum dos dois links marca aria-current.
      await expect(hoje.linkDeNavegacaoHoje).not.toHaveAttribute('aria-current', 'page');
      await expect(hoje.linkDeNavegacaoConfiguracoes).not.toHaveAttribute('aria-current', 'page');
    });

    await test.step('Dados → Hoje (pela <nav>), 1ª volta', async () => {
      await hoje.linkDeNavegacaoHoje.click();
      await expect(hoje.titulo).toBeVisible();
      await expect(page).toHaveTitle(NOME_DO_APP);
      await expect(hoje.linkDeNavegacaoHoje).toHaveAttribute('aria-current', 'page');
    });

    await test.step('Hoje → Configurações, de novo', async () => {
      await hoje.navegarParaConfiguracoes();
      await expect(config.titulo).toBeVisible();
      await expect(page).toHaveTitle(textos.comum.tituloDaPagina('Configurações'));
      await expect(hoje.linkDeNavegacaoConfiguracoes).toHaveAttribute('aria-current', 'page');
    });

    await test.step('Configurações → Hoje (pela <nav>), 2ª volta', async () => {
      await hoje.linkDeNavegacaoHoje.click();
      await expect(hoje.titulo).toBeVisible();
      await expect(page).toHaveTitle(NOME_DO_APP);
      await expect(hoje.linkDeNavegacaoHoje).toHaveAttribute('aria-current', 'page');
    });
  });
});

test.describe('foco e rolagem na troca de tela (critério 9)', () => {
  test('em Configurações, ativar o link para Dados pelo teclado (Enter) foca o <h1> de Dados e o traz para a vista', async ({
    page,
  }) => {
    const config = new PaginaConfiguracoes(page);
    await config.abrir();

    await config.linkParaDados.scrollIntoViewIfNeeded();
    await config.linkParaDados.focus();
    await expect(config.linkParaDados).toBeFocused();
    await page.keyboard.press('Enter');

    const dados = new PaginaDados(page);
    await expect(dados.titulo).toBeVisible();
    await expect(dados.titulo).toBeFocused();

    const h1DentroDaTela = await dados.titulo.evaluate((elemento) => {
      const retangulo = elemento.getBoundingClientRect();
      return retangulo.top >= 0 && retangulo.bottom <= window.innerHeight;
    });
    expect(h1DentroDaTela).toBe(true);
  });

  test('no primeiro carregamento de /, o foco não é movido: o elemento ativo é o <body>', async ({
    page,
  }) => {
    const hoje = new PaginaHoje(page);
    await hoje.abrir();

    const nomeDaTagAtiva = await page.evaluate(() => document.activeElement?.tagName ?? null);
    expect(nomeDaTagAtiva).toBe('BODY');
  });
});

test.describe('rota desconhecida (critério 10)', () => {
  test('/nao-existe termina em / com a Hoje visível', async ({ page }) => {
    await page.goto('/nao-existe');

    const hoje = new PaginaHoje(page);
    await expect(hoje.titulo).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test.describe('offline (Chromium, D3/pendência 10 do docs/PLANO.md)', () => {
    test('/nao-existe offline (depois do primeiro carregamento com rede) também termina em / com a Hoje visível', async ({
      page,
      context,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'android-chromium',
        'Offline validado só em Chromium (pendência 10 do docs/PLANO.md, D3), mesmo padrão de e2e/dados.spec.ts e e2e/pwa.spec.ts.',
      );

      const hoje = new PaginaHoje(page);
      await hoje.abrir(); // primeiro carregamento, com rede
      await page.evaluate(() => navigator.serviceWorker.ready);

      await context.setOffline(true);

      await page.goto('/nao-existe');
      await expect(hoje.titulo).toBeVisible();
      await expect(page).toHaveURL(/\/$/);

      await context.setOffline(false);
    });
  });
});
