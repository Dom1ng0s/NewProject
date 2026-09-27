/**
 * E2e da tela `/configuracoes` (ADR 0008, seção 13, critérios 9-16; 3 e 4 são
 * checagens estáticas de arquivo, sem navegador, complementares às do
 * `revisor-critico`). Relógio controlado via `page.clock.setFixedTime`
 * (nunca a data real do dia em que a suíte roda), mesmo padrão de
 * `e2e/dados.spec.ts` — esta tela não mostra data, mas nada aqui depende do
 * dia em que a suíte roda de qualquer forma.
 *
 * NUNCA importar `@/modulos/nucleo` aqui: o barrel reexporta `Configuracoes.tsx`,
 * que importa um `.module.css`, e o runner do Playwright (Node puro) não sabe
 * transformar CSS (mesmo aviso de `e2e/dados.spec.ts`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Download, Locator, Page } from '@playwright/test';
import { test as testeDeArquivo, expect as expectDeArquivo } from '@playwright/test';
import { textos } from '@/i18n';
import { test, expect } from './fixtures/base';
import { PaginaHoje } from './paginas/hoje';
import { PaginaDados } from './paginas/dados';
import { PaginaConfiguracoes } from './paginas/configuracoes';

const t = textos.nucleo.configuracoes;

const RAIZ_DO_REPOSITORIO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const AGORA_FIXO = '2026-09-23T15:00:00.000Z'; // 12:00 em America/Sao_Paulo (UTC-3)

interface ConfiguracoesExportadas {
  metaSemanalDeFocoEmMinutos: number;
  metaSemanalDeTreinos: number;
  orcamentoMensalEmCentavos: number | null;
  unidadeDePeso: 'kg' | 'lb';
  tema: 'sistema' | 'claro' | 'escuro';
  onboardingConcluidoEm: string | null;
}
interface AcaoExportada {
  tipo: string;
  deletedAt: string | null;
}
interface BackupExportado {
  modulos: {
    nucleo: {
      configuracoes: ConfiguracoesExportadas[];
      historicoDeAcoes: AcaoExportada[];
    };
  };
}

async function lerTextoDoDownload(download: Download): Promise<string> {
  const caminho = await download.path();
  if (!caminho) throw new Error('Download sem caminho local (Playwright não salvou o arquivo).');
  return readFile(caminho, 'utf-8');
}

async function exportarBackupDaTela(dados: PaginaDados): Promise<BackupExportado> {
  const download = await dados.clicarEBaixar(dados.botaoExportarBackup);
  return JSON.parse(await lerTextoDoDownload(download)) as BackupExportado;
}

/**
 * Normaliza um hex de cor para 6 dígitos minúsculos: o CSS minificado do
 * build de produção (`npm run build`, que é o que `webServer` do Playwright
 * serve) encurta `#ffffff` para `#fff` quando os três pares de dígitos são
 * iguais — `--cor-fundo` é lido de `getComputedStyle`, então o valor
 * observado é sempre o pós-minificação, não o texto de `tokens.css`.
 */
function normalizarHex(cor: string): string {
  const semHash = cor.trim().replace(/^#/u, '').toLowerCase();
  if (semHash.length === 3) {
    return `#${[...semHash].map((digito) => digito + digito).join('')}`;
  }
  return `#${semHash}`;
}

/** Os dois `<meta name="theme-color">` (ADR 0007) precisam ter o mesmo valor calculado do tema atual. */
async function expectThemeColor(pagina: Page, hex: string) {
  const metas = pagina.locator('meta[name="theme-color"]');
  await expect(metas).toHaveCount(2);
  const esperado = normalizarHex(hex);
  await expect
    .poll(async () => {
      const conteudos = await metas.evaluateAll((elementos) =>
        elementos.map((elemento) => elemento.getAttribute('content') ?? ''),
      );
      return conteudos.map((conteudo) => normalizarHex(conteudo));
    })
    .toEqual([esperado, esperado]);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AGORA_FIXO);
});

test('abre /configuracoes a partir de um link na Hoje', async ({ page }) => {
  const hoje = new PaginaHoje(page);
  await hoje.abrir();

  await hoje.navegarParaConfiguracoes();

  await expect(page).toHaveURL(/\/configuracoes$/);
  const config = new PaginaConfiguracoes(page);
  await expect(config.titulo).toBeVisible();
});

test('banco vazio: valores padrão (D11, critério 9)', async ({ page }) => {
  const config = new PaginaConfiguracoes(page);
  await config.abrir();

  await expect(config.campoFoco).toHaveValue('10');
  await expect(config.campoTreinos).toHaveValue('3');
  await expect(config.campoOrcamento).toHaveValue('');
  await expect(config.radioKg).toBeChecked();
  await expect(config.radioSistema).toBeChecked();
});

test('editar cada campo confirma e persiste; recarregar mantém; backup confere os valores certos (critério 10)', async ({
  page,
}) => {
  const config = new PaginaConfiguracoes(page);
  await config.abrir();

  await test.step('meta de foco: 7,5, confirmado com Tab', async () => {
    await config.campoFoco.fill('7,5');
    await config.campoFoco.press('Tab');
    await expect(config.status).toHaveText(t.salvo.metaSemanalDeFocoEmMinutos);
  });

  await test.step('meta de treinos: 4, confirmado com Tab', async () => {
    await config.campoTreinos.fill('4');
    await config.campoTreinos.press('Tab');
    await expect(config.status).toHaveText(t.salvo.metaSemanalDeTreinos);
  });

  await test.step('orçamento: 1.500,00, confirmado com Tab', async () => {
    await config.campoOrcamento.fill('1.500,00');
    await config.campoOrcamento.press('Tab');
    await expect(config.status).toHaveText(t.salvo.orcamentoMensalEmCentavos);
  });

  await test.step('unidade: Libras (lb)', async () => {
    await config.radioLb.check();
    await expect(config.status).toHaveText(t.salvo.unidadeDePeso);
  });

  await test.step('tema: Escuro', async () => {
    await config.radioEscuro.check();
    await expect(config.status).toHaveText(t.salvo.tema);
  });

  await test.step('recarregar a página mantém os valores exibidos', async () => {
    await page.reload();
    await expect(config.titulo).toBeVisible();
    await expect(config.campoFoco).toHaveValue('7,5');
    await expect(config.campoTreinos).toHaveValue('4');
    await expect(config.campoOrcamento).toHaveValue('1.500,00');
    await expect(config.radioLb).toBeChecked();
    await expect(config.radioEscuro).toBeChecked();
  });

  await test.step('backup exportado em /dados confere os valores certos', async () => {
    await config.linkParaDados.click();
    const dados = new PaginaDados(page);
    await expect(dados.titulo).toBeVisible();
    const exportado = await exportarBackupDaTela(dados);
    expect(exportado.modulos.nucleo.configuracoes).toHaveLength(1);
    expect(exportado.modulos.nucleo.configuracoes[0]).toMatchObject({
      metaSemanalDeFocoEmMinutos: 450,
      metaSemanalDeTreinos: 4,
      orcamentoMensalEmCentavos: 150000,
      unidadeDePeso: 'lb',
      tema: 'escuro',
      onboardingConcluidoEm: null,
    });
  });
});

test('apagar o texto do orçamento e confirmar grava null ("Orçamento removido.") (critério 11)', async ({
  page,
}) => {
  const config = new PaginaConfiguracoes(page);
  await config.abrir();

  await config.campoOrcamento.fill('1500');
  await config.campoOrcamento.press('Tab');
  await expect(config.status).toHaveText(t.salvo.orcamentoMensalEmCentavos);

  await config.campoOrcamento.fill('');
  await config.campoOrcamento.press('Tab');
  await expect(config.status).toHaveText(t.salvo.orcamentoRemovido);
  await expect(config.campoOrcamento).toHaveValue('');

  await config.linkParaDados.click();
  const dados = new PaginaDados(page);
  await expect(dados.titulo).toBeVisible();
  const exportado = await exportarBackupDaTela(dados);
  expect(exportado.modulos.nucleo.configuracoes[0]?.orcamentoMensalEmCentavos).toBeNull();
});

test.describe('erros de formato/regra não gravam (critério 12)', () => {
  test('treinos negativo, foco com duas casas decimais, orçamento com letras: erro certo, mantém o texto, não grava; corrigir grava', async ({
    page,
  }) => {
    const config = new PaginaConfiguracoes(page);
    await config.abrir();

    await test.step('treinos: -1 → negativoTreinos, aria-invalid, mantém o texto "-1"', async () => {
      await config.campoTreinos.fill('-1');
      await config.campoTreinos.press('Tab');
      await expect(config.erroTreinos).toHaveText(t.erros.negativoTreinos);
      await expect(config.campoTreinos).toHaveAttribute('aria-invalid', 'true');
      await expect(config.campoTreinos).toHaveValue('-1');
    });

    await test.step('foco: 7,25 (duas casas) → formatoFoco', async () => {
      await config.campoFoco.fill('7,25');
      await config.campoFoco.press('Tab');
      await expect(config.erroFoco).toHaveText(t.erros.formatoFoco);
      await expect(config.campoFoco).toHaveAttribute('aria-invalid', 'true');
    });

    await test.step('orçamento: abc → formatoOrcamento', async () => {
      await config.campoOrcamento.fill('abc');
      await config.campoOrcamento.press('Tab');
      await expect(config.erroOrcamento).toHaveText(t.erros.formatoOrcamento);
      await expect(config.campoOrcamento).toHaveAttribute('aria-invalid', 'true');
    });

    await test.step('recarregar: os valores voltam aos gravados anteriormente (nada foi salvo)', async () => {
      await page.reload();
      await expect(config.titulo).toBeVisible();
      await expect(config.campoTreinos).toHaveValue('3');
      await expect(config.campoFoco).toHaveValue('10');
      await expect(config.campoOrcamento).toHaveValue('');
    });

    await test.step('corrigir o texto e confirmar limpa o erro e grava', async () => {
      await config.campoTreinos.fill('5');
      await config.campoTreinos.press('Tab');
      await expect(config.status).toHaveText(t.salvo.metaSemanalDeTreinos);
      await expect(config.campoTreinos).toHaveValue('5');
      await expect(config.campoTreinos).not.toHaveAttribute('aria-invalid', 'true');
      await expect(config.erroTreinos).toHaveText('');
    });
  });
});

test('tocar um campo e sair sem alterar não grava (sem ação nova no histórico) (critério 13)', async ({
  page,
}) => {
  const config = new PaginaConfiguracoes(page);
  await config.abrir();

  async function contarAcoesDeConfiguracoesSalvas(): Promise<number> {
    await page.goto('/dados');
    const dados = new PaginaDados(page);
    await expect(dados.titulo).toBeVisible();
    const exportado = await exportarBackupDaTela(dados);
    return exportado.modulos.nucleo.historicoDeAcoes.filter(
      (acao) => acao.tipo === 'nucleo.configuracoesSalvas',
    ).length;
  }

  const antes = await contarAcoesDeConfiguracoesSalvas();

  await page.goto('/configuracoes');
  await expect(config.titulo).toBeVisible();

  for (const campo of [config.campoFoco, config.campoTreinos, config.campoOrcamento]) {
    await campo.focus();
    await campo.press('Tab');
  }

  const depois = await contarAcoesDeConfiguracoesSalvas();
  expect(depois).toBe(antes);
});

test.describe('tema aplicado de verdade (critério 14)', () => {
  test.use({ colorScheme: 'dark' });

  test('sistema escuro + "Seguir o sistema": data-tema="escuro" desde o 1º carregamento; trocar aplica na hora; recarregar mantém; theme-color acompanha', async ({
    page,
  }) => {
    const config = new PaginaConfiguracoes(page);
    await config.abrir();

    await expect(config.radioSistema).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');
    await expectThemeColor(page, '#121212');

    await config.radioClaro.check();
    await expect(config.status).toHaveText(t.salvo.tema);
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
    const corDeFundo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(corDeFundo).toBe('rgb(255, 255, 255)');
    await expectThemeColor(page, '#ffffff');

    await page.reload();
    await expect(config.titulo).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');

    await config.radioSistema.check();
    await expect(config.status).toHaveText(t.salvo.tema);
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');

    // Sem recarregar: só muda o sistema emulado.
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
    await expectThemeColor(page, '#ffffff');
  });
});

test.describe('sobrevive ao fechamento offline (critério 15) @chromium', () => {
  test('alterar o foco offline sem sair do campo, simular ida para segundo plano, fechar e reabrir no mesmo contexto: o valor novo persiste', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'android-chromium',
      'Offline validado só em Chromium (pendência 10 do docs/PLANO.md, D3), mesmo padrão de e2e/dados.spec.ts e e2e/pwa.spec.ts.',
    );

    const config = new PaginaConfiguracoes(page);
    await config.abrir(); // primeiro carregamento, com rede

    // Espera o service worker ficar ativo ANTES de ir offline: o teste abre
    // uma página NOVA mais abaixo (`context.newPage()`), e a primeira
    // navegação dessa página só é interceptada pelo service worker (em vez
    // de ir para a rede, que já estará offline) se ele já estiver ativo
    // nesse instante — mesma checagem de `e2e/pwa.spec.ts`, critério 7.
    await page.evaluate(() => navigator.serviceWorker.ready);

    await context.setOffline(true);

    const falhasDeRequisicao: string[] = [];
    page.on('requestfailed', (requisicao) => falhasDeRequisicao.push(requisicao.url()));

    await config.campoFoco.fill('12'); // não sai do campo: mantém o foco

    // Simula o app indo para segundo plano com o teclado aberto (o Playwright
    // não dispara `visibilitychange` de forma determinística no `page.close()`).
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect(config.status).toHaveText(t.salvo.metaSemanalDeFocoEmMinutos);
    expect(falhasDeRequisicao).toEqual([]);

    await page.close();

    const novaPagina = await context.newPage();
    const novaConfig = new PaginaConfiguracoes(novaPagina);
    await novaConfig.abrir();
    await expect(novaConfig.campoFoco).toHaveValue('12');

    await context.setOffline(false);
  });
});

test.describe('teclado e alvo de toque (critério 16)', () => {
  test('navegação só por teclado (Tab/digitação/Enter/setas) altera um campo de texto de cada meta e o grupo de rádios, sem mouse', async ({
    page,
  }) => {
    const config = new PaginaConfiguracoes(page);
    await config.abrir();

    await config.campoFoco.focus();
    await expect(config.campoFoco).toBeFocused();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('7,5');
    await page.keyboard.press('Enter');
    await expect(config.status).toHaveText(t.salvo.metaSemanalDeFocoEmMinutos);
    await expect(config.campoFoco).toHaveValue('7,5');

    await page.keyboard.press('Tab');
    await expect(config.campoTreinos).toBeFocused();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('5');
    await page.keyboard.press('Enter');
    await expect(config.status).toHaveText(t.salvo.metaSemanalDeTreinos);
    await expect(config.campoTreinos).toHaveValue('5');

    await page.keyboard.press('Tab');
    await expect(config.campoOrcamento).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(config.radioKg).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(config.radioLb).toBeFocused();
    await expect(config.radioLb).toBeChecked();
    await expect(config.status).toHaveText(t.salvo.unidadeDePeso);
  });

  test('todo campo, cada rótulo de opção e o link para /dados têm pelo menos 44×44px', async ({
    page,
  }) => {
    const config = new PaginaConfiguracoes(page);
    await config.abrir();

    async function medir(nome: string, alvo: Locator): Promise<void> {
      const caixa = await alvo.boundingBox();
      if (!caixa) throw new Error(`"${nome}" não tem bounding box (não está visível?).`);
      expect(caixa.width, `${nome}: largura`).toBeGreaterThanOrEqual(44);
      expect(caixa.height, `${nome}: altura`).toBeGreaterThanOrEqual(44);
    }

    await medir('Horas de foco por semana', config.campoFoco);
    await medir('Treinos por semana', config.campoTreinos);
    await medir('Orçamento do mês (R$)', config.campoOrcamento);

    const rotulosDeRadios: readonly [string, Locator][] = [
      [t.unidades.kg, config.radioKg],
      [t.unidades.lb, config.radioLb],
      [t.aparencia.sistema, config.radioSistema],
      [t.aparencia.claro, config.radioClaro],
      [t.aparencia.escuro, config.radioEscuro],
    ];
    for (const [nome, radio] of rotulosDeRadios) {
      await medir(`rótulo de "${nome}"`, config.rotuloDoRadio(radio));
    }

    await medir('Link para /dados', config.linkParaDados);
  });
});

// ---------------------------------------------------------------------------
// Checagens estáticas de arquivo (sem navegador), critérios 3 e 4.
// ---------------------------------------------------------------------------

// O critério 3 original (item 0.10) checava que nenhum arquivo de
// src/persistencia/**, repositorio/configuracoes.ts,
// repositorio/contrato-de-dados.ts ou dominio/backup/** mudava naquela
// entrega específica — uma checagem pontual daquele PR, não um invariante
// permanente. A partir da Fase 1 (item 1.1, migração v2 de financas) essas
// mesmas pastas mudam legitimamente a cada fase que evolui o schema; a
// checagem ficaria sempre vermelha e por isso foi removida aqui. A garantia
// real de migração testada (schema versionado, teste de migração, tabela em
// `TABELAS`) é do `src/persistencia/migracoes/*.test.ts` de cada versão.

testeDeArquivo.describe('fronteiras (critério 4)', () => {
  testeDeArquivo(
    'Configuracoes.tsx só importa de @/modulos/nucleo, @/ui, @/i18n, @/compartilhado (ou caminho relativo dentro do módulo), react ou react-router',
    () => {
      const caminho = path.join(
        RAIZ_DO_REPOSITORIO,
        'src',
        'modulos',
        'nucleo',
        'telas',
        'Configuracoes.tsx',
      );
      const conteudo = readFileSync(caminho, 'utf-8');
      const especificadores = [...conteudo.matchAll(/from\s+['"]([^'"]+)['"]/gu)].map(
        (m) => m[1] ?? '',
      );
      const permitido = (especificador: string) =>
        especificador.startsWith('@/modulos/nucleo') ||
        especificador.startsWith('@/ui') ||
        especificador.startsWith('@/i18n') ||
        especificador.startsWith('@/compartilhado') ||
        especificador.startsWith('./') ||
        especificador.startsWith('../') ||
        especificador === 'react' ||
        especificador === 'react-router';
      const proibidos = especificadores.filter((especificador) => !permitido(especificador));
      expectDeArquivo(proibidos).toEqual([]);
    },
  );

  testeDeArquivo('src/app/tema/** não importa "@/persistencia" nem "dexie"', () => {
    const pastaTema = path.join(RAIZ_DO_REPOSITORIO, 'src', 'app', 'tema');
    const arquivos = readdirSync(pastaTema).filter(
      (nome) => /\.(ts|tsx)$/u.test(nome) && !nome.endsWith('.test.ts'),
    );
    const comImportProibido = arquivos.filter((arquivo) => {
      const conteudo = readFileSync(path.join(pastaTema, arquivo), 'utf-8');
      return /from\s+['"](@\/persistencia|dexie)/u.test(conteudo);
    });
    expectDeArquivo(comImportProibido).toEqual([]);
  });
});
