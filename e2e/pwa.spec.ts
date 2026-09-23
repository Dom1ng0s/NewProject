/**
 * E2e do item 0.7 (ADR 0007, seção 8, critérios 1-15; 16 é do `revisor-critico`
 * e 17 do orquestrador). Relógio controlado via `page.clock.setFixedTime`
 * (nunca a data real do dia em que a suíte roda) nos testes que tocam a tela
 * `/dados`, mesmo quando a data em si não é verificada — consistência com
 * `e2e/dados.spec.ts`.
 *
 * Alguns critérios (2, 3, 8, 14) são checagens de arquivo/processo puras, sem
 * necessidade de navegador: usam `test` importado direto de
 * `@playwright/test` (sem o fixture `guardaDeConsole` de `./fixtures/base`,
 * que força a criação de uma página). Os demais usam `./fixtures/base` para
 * herdar a guarda de `console.error`/exceção não tratada.
 *
 * Critérios validados só em Chromium (pendência 10 do docs/PLANO.md, D3):
 * offline (7), cache do service worker (9) e instalabilidade via CDP (5) —
 * o protocolo do Chrome não existe em WebKit. O teste de `npm run icones`
 * (critério 3) roda só numa engine, porque os dois projetos executam este
 * arquivo em processos concorrentes e ele REGRAVA os 5 arquivos de
 * `public/icones/` — sem isso, os dois processos disputariam a escrita dos
 * mesmos arquivos ao mesmo tempo. O teste do critério 8 builda para uma
 * pasta isolada em `test-results/` (nunca `dist/`, que o `webServer` do
 * Playwright já está servindo para o resto da suíte rodando em paralelo) e
 * por isso pode rodar nos dois projetos sem colidir com nada.
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Download } from '@playwright/test';
import { test as testeDeArquivo, expect as expectDeArquivo } from '@playwright/test';
import { textos, NOME_DO_APP, DESCRICAO_DO_APP } from '@/i18n';
import { test, expect } from './fixtures/base';
import { PaginaHoje } from './paginas/hoje';
import { PaginaDados } from './paginas/dados';

const RAIZ_DO_REPOSITORIO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRETORIO_DESTE_ARQUIVO = path.dirname(fileURLToPath(import.meta.url));
const CAMINHO_DA_FIXTURE = path.join(DIRETORIO_DESTE_ARQUIVO, 'fixtures', 'backup-exemplo.json');

const AGORA_FIXO = '2026-09-23T15:00:00.000Z'; // 12:00 em America/Sao_Paulo (UTC-3)

async function lerTextoDoDownload(download: Download): Promise<string> {
  const caminho = await download.path();
  if (!caminho) throw new Error('Download sem caminho local (Playwright não salvou o arquivo).');
  return readFile(caminho, 'utf-8');
}

// ---------------------------------------------------------------------------
// Utilitários de arquivo (Node puro, reaproveitados pelas seções 2/3/8/14).
// ---------------------------------------------------------------------------

const PASTAS_IGNORADAS = new Set([
  'node_modules',
  'dist',
  'dev-dist',
  'coverage',
  'test-results',
  'playwright-report',
  '.git',
]);

/** Lista, recursivamente, todo arquivo sob `dir` (caminhos absolutos). */
function listarArquivosRecursivo(dir: string): string[] {
  const arquivos: string[] = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (PASTAS_IGNORADAS.has(entrada.name)) continue;
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      arquivos.push(...listarArquivosRecursivo(caminho));
    } else {
      arquivos.push(caminho);
    }
  }
  return arquivos;
}

function hashDeArquivo(caminho: string): string {
  return createHash('sha256').update(readFileSync(caminho)).digest('hex');
}

/** Lê a largura/altura de um PNG a partir do cabeçalho IHDR (bytes 16-23), sem dependência. */
function tamanhoDoPng(caminho: string): { largura: number; altura: number } {
  const buffer = readFileSync(caminho);
  const assinaturaPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(assinaturaPng)) {
    throw new Error(`${caminho} não começa com a assinatura PNG.`);
  }
  return { largura: buffer.readUInt32BE(16), altura: buffer.readUInt32BE(20) };
}

// ---------------------------------------------------------------------------
// Critério 2: nenhuma dependência nova; nenhum acesso de rede fora da origem.
// ---------------------------------------------------------------------------

testeDeArquivo.describe('nenhuma dependência nova (critério 2)', () => {
  testeDeArquivo(
    'package.json: dependencies/devDependencies iguais ao commit anterior (item 0.6); só o script "icones" foi acrescentado',
    () => {
      const pacoteAtual = JSON.parse(
        readFileSync(path.join(RAIZ_DO_REPOSITORIO, 'package.json'), 'utf-8'),
      ) as {
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
        scripts: Record<string, string>;
      };
      const textoAnterior = execFileSync('git', ['show', 'HEAD:package.json'], {
        cwd: RAIZ_DO_REPOSITORIO,
        encoding: 'utf-8',
      });
      const pacoteAnterior = JSON.parse(textoAnterior) as typeof pacoteAtual;

      expectDeArquivo(pacoteAtual.dependencies).toEqual(pacoteAnterior.dependencies);
      expectDeArquivo(pacoteAtual.devDependencies).toEqual(pacoteAnterior.devDependencies);

      // Só o script "icones" muda: mesmas chaves de `scripts`, mais uma.
      const chavesNovas = Object.keys(pacoteAtual.scripts).filter(
        (chave) => !(chave in pacoteAnterior.scripts),
      );
      expectDeArquivo(chavesNovas).toEqual(['icones']);
      for (const chave of Object.keys(pacoteAnterior.scripts)) {
        expectDeArquivo(pacoteAtual.scripts[chave]).toBe(pacoteAnterior.scripts[chave]);
      }
    },
  );

  testeDeArquivo(
    'nenhum fetch/XHR/WebSocket/EventSource/sendBeacon nem URL http(s) de terceiros em src/, index.html ou vite.config.ts',
    () => {
      const arquivos = [
        ...listarArquivosRecursivo(path.join(RAIZ_DO_REPOSITORIO, 'src')),
        path.join(RAIZ_DO_REPOSITORIO, 'index.html'),
        path.join(RAIZ_DO_REPOSITORIO, 'vite.config.ts'),
      ];
      const padroesProibidos: RegExp[] = [
        /\bfetch\s*\(/u,
        /\bXMLHttpRequest\b/u,
        /\bWebSocket\b/u,
        /\bEventSource\b/u,
        /\bsendBeacon\b/u,
        /https?:\/\//u,
      ];

      const ocorrencias: string[] = [];
      for (const arquivo of arquivos) {
        const conteudo = readFileSync(arquivo, 'utf-8');
        for (const padrao of padroesProibidos) {
          if (padrao.test(conteudo)) {
            ocorrencias.push(
              `${path.relative(RAIZ_DO_REPOSITORIO, arquivo)}: ${padrao.toString()}`,
            );
          }
        }
      }
      expectDeArquivo(ocorrencias).toEqual([]);
    },
  );
});

// ---------------------------------------------------------------------------
// Critério 3: ícones nos tamanhos certos + `npm run icones` reprodutível.
// ---------------------------------------------------------------------------

testeDeArquivo.describe('ícones provisórios (critério 3)', () => {
  // Serial: o último teste deste bloco REESCREVE os arquivos que os testes
  // de tamanho/SVG acima leem. `fullyParallel: true` (playwright.config.ts)
  // paralelizaria mesmo tests do MESMO describe em workers diferentes sem
  // isto, arriscando ler um PNG a meio caminho de ser regravado.
  testeDeArquivo.describe.configure({ mode: 'serial' });

  const PASTA_ICONES = path.join(RAIZ_DO_REPOSITORIO, 'public', 'icones');
  const TAMANHOS_ESPERADOS: Record<string, number> = {
    'icone-192.png': 192,
    'icone-512.png': 512,
    'icone-maskable-512.png': 512,
    'apple-touch-icon-180.png': 180,
  };

  for (const [arquivo, lado] of Object.entries(TAMANHOS_ESPERADOS)) {
    testeDeArquivo(`${arquivo} é ${lado}×${lado}`, () => {
      const { largura, altura } = tamanhoDoPng(path.join(PASTA_ICONES, arquivo));
      expectDeArquivo(largura).toBe(lado);
      expectDeArquivo(altura).toBe(lado);
    });
  }

  testeDeArquivo('icone.svg existe e começa com <svg', () => {
    const conteudo = readFileSync(path.join(PASTA_ICONES, 'icone.svg'), 'utf-8').trim();
    expectDeArquivo(conteudo.startsWith('<svg')).toBe(true);
  });

  testeDeArquivo(
    '`npm run icones` roda sem erro e regenera exatamente os mesmos 5 arquivos (byte a byte)',
    ({ browserName }) => {
      // Roda numa só engine: os dois projetos rodam este ARQUIVO em processos
      // concorrentes, e "serial" (acima) só serializa DENTRO de um projeto —
      // sem este skip, os dois seriam capazes de regravar os mesmos 5
      // arquivos de `public/icones/` ao mesmo tempo. A regeneração não
      // depende do navegador que roda o teste (é sempre Chromium por dentro
      // do script, ADR 0007 §1), então a engine escolhida aqui é arbitrária.
      testeDeArquivo.skip(
        browserName !== 'webkit',
        'Roda só numa engine para não regravar public/icones/ de dois processos ao mesmo tempo.',
      );
      testeDeArquivo.setTimeout(60_000);

      const arquivos = [
        'icone-192.png',
        'icone-512.png',
        'icone-maskable-512.png',
        'apple-touch-icon-180.png',
        'icone.svg',
      ].map((nome) => path.join(PASTA_ICONES, nome));
      const hashesAntes = arquivos.map(hashDeArquivo);

      execFileSync('npm', ['run', 'icones'], {
        cwd: RAIZ_DO_REPOSITORIO,
        stdio: 'pipe',
        shell: process.platform === 'win32',
      });

      const hashesDepois = arquivos.map(hashDeArquivo);
      expectDeArquivo(hashesDepois).toEqual(hashesAntes);
    },
  );
});

// ---------------------------------------------------------------------------
// Critério 4: manifesto com o conteúdo certo, nos dois projetos.
// ---------------------------------------------------------------------------

test.describe('manifesto (critério 4)', () => {
  interface IconeDoManifesto {
    readonly src: string;
    readonly sizes: string;
    readonly type: string;
    readonly purpose?: string;
  }
  interface Manifesto {
    readonly name: string;
    readonly short_name: string;
    readonly description: string;
    readonly lang: string;
    readonly display: string;
    readonly start_url: string;
    readonly scope: string;
    readonly id: string;
    readonly orientation?: string;
    readonly icons: readonly IconeDoManifesto[];
  }

  test('/manifest.webmanifest tem name/short_name/description/lang/display/start_url/scope/id certos, sem orientation, e 3 ícones (2 sem purpose + 1 maskable)', async ({
    request,
  }) => {
    const resposta = await request.get('/manifest.webmanifest');
    expect(resposta.status()).toBe(200);
    const manifesto = (await resposta.json()) as Manifesto;

    expect(manifesto.name).toBe(NOME_DO_APP);
    expect(manifesto.short_name).toBe(NOME_DO_APP);
    expect(manifesto.description).toBe(DESCRICAO_DO_APP);
    expect(manifesto.lang).toBe('pt-BR');
    expect(manifesto.display).toBe('standalone');
    expect(manifesto.start_url).toBe('/');
    expect(manifesto.scope).toBe('/');
    expect(manifesto.id).toBe('/');
    expect(manifesto.orientation).toBeUndefined();

    expect(manifesto.icons).toHaveLength(3);
    const semPurpose = manifesto.icons.filter((icone) => icone.purpose === undefined);
    const maskable = manifesto.icons.filter((icone) => icone.purpose === 'maskable');
    expect(semPurpose.map((i) => i.sizes).sort()).toEqual(['192x192', '512x512']);
    expect(maskable).toHaveLength(1);
    expect(maskable[0]?.sizes).toBe('512x512');

    for (const icone of manifesto.icons) {
      const respostaDoIcone = await request.get(icone.src);
      expect(respostaDoIcone.status(), icone.src).toBe(200);
      expect(respostaDoIcone.headers()['content-type'], icone.src).toBe('image/png');
    }
  });
});

// ---------------------------------------------------------------------------
// Critério 5: instalabilidade via CDP, só em Chromium.
// ---------------------------------------------------------------------------

test.describe('instalabilidade (critério 5, só Chromium)', () => {
  test('Page.getAppManifest sem erros e Page.getInstallabilityErrors vazio (tolerando só in-incognito)', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'android-chromium',
      'Page.getAppManifest/getInstallabilityErrors só existem no protocolo do Chrome (ADR 0007, fato 2).',
    );

    const hoje = new PaginaHoje(page);
    await hoje.abrir();

    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.enable');

    const manifesto = (await cdp.send('Page.getAppManifest')) as { errors: readonly unknown[] };
    expect(manifesto.errors).toEqual([]);

    const instalabilidade = (await cdp.send('Page.getInstallabilityErrors')) as {
      installabilityErrors: readonly { errorId: string }[];
    };
    const errosNaoTolerados = instalabilidade.installabilityErrors.filter(
      (erro) => erro.errorId !== 'in-incognito',
    );
    expect(errosNaoTolerados).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Critério 6: index.html sem placeholder sobrando.
// ---------------------------------------------------------------------------

test.describe('index.html sem placeholder sobrando (critério 6)', () => {
  test('title, meta description, apple-mobile-web-app-title, ícones e theme-color têm valor real; nenhum %NOME_DO_APP%/%DESCRICAO_DO_APP%', async ({
    request,
  }) => {
    const resposta = await request.get('/');
    expect(resposta.status()).toBe(200);
    const html = await resposta.text();

    expect(html).toContain(`<title>${NOME_DO_APP}</title>`);
    expect(html).toContain(`<meta name="description" content="${DESCRICAO_DO_APP}" />`);
    expect(html).toContain(`<meta name="apple-mobile-web-app-title" content="${NOME_DO_APP}" />`);
    expect(html).toContain('<link rel="icon" href="/icones/icone.svg" type="image/svg+xml" />');
    expect(html).toContain(
      '<link rel="apple-touch-icon" href="/icones/apple-touch-icon-180.png" />',
    );

    const metasThemeColor = [...html.matchAll(/<meta name="theme-color"[^>]*>/gu)];
    expect(metasThemeColor).toHaveLength(2);
    for (const meta of metasThemeColor) {
      expect(meta[0]).toContain('media="(prefers-color-scheme:');
    }

    expect(html).not.toContain('%NOME_DO_APP%');
    expect(html).not.toContain('%DESCRICAO_DO_APP%');

    const respostaDoIcone = await request.get('/icones/apple-touch-icon-180.png');
    expect(respostaDoIcone.status()).toBe(200);
  });
});

testeDeArquivo.describe('index.html sem placeholder sobrando (critério 6, parte estática)', () => {
  testeDeArquivo("'[NOME DO APP]' só aparece escrito em src/i18n/pt-BR/comum.ts", () => {
    const arquivos = listarArquivosRecursivo(path.join(RAIZ_DO_REPOSITORIO, 'src')).filter(
      (arquivo) => /\.(ts|tsx)$/u.test(arquivo),
    );
    const comArquivo = arquivos.filter((arquivo) =>
      readFileSync(arquivo, 'utf-8').includes('[NOME DO APP]'),
    );
    expectDeArquivo(comArquivo.map((a) => path.relative(RAIZ_DO_REPOSITORIO, a))).toEqual([
      path.join('src', 'i18n', 'pt-BR', 'comum.ts'),
    ]);
  });
});

// ---------------------------------------------------------------------------
// Critério 7: offline completo depois do primeiro carregamento (só Chromium).
// ---------------------------------------------------------------------------

test.describe('offline completo (critério 7, só Chromium, D3/pendência 10)', () => {
  test('reload, navegação direta para /dados e importar/exportar continuam funcionando sem rede, sem requestfailed nem console.error', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'android-chromium',
      'Offline validado só em Chromium (D3/pendência 10 do docs/PLANO.md).',
    );

    await page.clock.setFixedTime(AGORA_FIXO);

    const hoje = new PaginaHoje(page);
    await hoje.abrir(); // primeiro carregamento, com rede

    await page.evaluate(() => navigator.serviceWorker.ready);

    const falhasDeRequisicao: string[] = [];
    page.on('requestfailed', (requisicao) => falhasDeRequisicao.push(requisicao.url()));

    await context.setOffline(true);

    await page.reload();
    await expect(hoje.raiz).not.toBeEmpty(); // a Hoje aparece offline

    const dados = new PaginaDados(page);
    await page.goto('/dados'); // navegação de verdade (não link), prova do navigateFallback
    await expect(dados.titulo).toBeVisible();

    await dados.escolherArquivoParaImportar(CAMINHO_DA_FIXTURE);
    await expect(dados.resumoImportacao).toBeVisible();
    await dados.botaoConfirmarImportacao.click();
    await expect(dados.avisoDeSucessoImportacao).toBeVisible();

    await page.reload();
    await expect(dados.titulo).toBeVisible();

    const download = await dados.clicarEBaixar(dados.botaoExportarBackup);
    const exportado = JSON.parse(await lerTextoDoDownload(download)) as {
      modulos: { nucleo: { configuracoes: unknown[]; historicoDeAcoes: unknown[] } };
    };
    expect(exportado.modulos.nucleo.configuracoes).toHaveLength(1);
    expect(exportado.modulos.nucleo.historicoDeAcoes).toHaveLength(2);

    expect(falhasDeRequisicao).toEqual([]);

    await context.setOffline(false);
  });
});

// ---------------------------------------------------------------------------
// Critério 8: precache cobre o build inteiro.
// ---------------------------------------------------------------------------

testeDeArquivo.describe('precache cobre o build inteiro (critério 8)', () => {
  testeDeArquivo(
    'sw.js precacheia index.html, manifest.webmanifest, todo .js/.css de assets e os ícones; nenhum .map; build sem aviso de "will not be precached"',
    () => {
      // Sem parâmetro de fixture, pelo mesmo motivo do teste de `npm run icones`
      // acima: roda (de novo) em ambos os projetos em vez de fingir precisar
      // de uma fixture só para poder pular condicionalmente por projeto.
      testeDeArquivo.setTimeout(60_000);

      // Builda para uma pasta ISOLADA (não `dist/`, que o `webServer` do
      // Playwright já está servindo para o resto da suíte rodando em
      // paralelo): reconstruir `dist/` no meio da suíte quebrava, na prática,
      // testes completamente alheios (ex.: `app-carrega.spec.ts`,
      // `dados.spec.ts`) com "unsupported MIME type" — a `vite preview`
      // respondia com HTML de fallback para um `.js` momentaneamente ausente
      // durante a reescrita de `dist/`. `--outDir` usa o mesmo `vite.config.ts`
      // (mesmo `public/`, mesmo plugin PWA), só muda onde o resultado é escrito.
      // Nome único por chamada: este teste roda nos dois projetos, possivelmente
      // em paralelo (workers/processos diferentes) — cada um builda na sua
      // própria pasta, sem disputar o mesmo diretório.
      const pastaDeSaida = path.join(
        RAIZ_DO_REPOSITORIO,
        'test-results',
        `verificacao-precache-${randomUUID()}`,
      );
      try {
        const saidaDoBuild = execFileSync('npx', ['vite', 'build', '--outDir', pastaDeSaida], {
          cwd: RAIZ_DO_REPOSITORIO,
          encoding: 'utf-8',
          shell: process.platform === 'win32',
        });
        expectDeArquivo(saidaDoBuild.toLowerCase()).not.toContain('will not be precached');

        const caminhoDoSw = path.join(pastaDeSaida, 'sw.js');
        const conteudoDoSw = readFileSync(caminhoDoSw, 'utf-8');
        const urlsPrecacheadas = [...conteudoDoSw.matchAll(/url:"([^"]+)"/gu)].map((m) => m[1]);

        expectDeArquivo(urlsPrecacheadas.length).toBeGreaterThan(0);
        expectDeArquivo(urlsPrecacheadas.some((url) => url?.endsWith('.map'))).toBe(false);

        expectDeArquivo(urlsPrecacheadas).toContain('index.html');
        expectDeArquivo(urlsPrecacheadas).toContain('manifest.webmanifest');

        const pastaAssets = path.join(pastaDeSaida, 'assets');
        const arquivosDeAssets = readdirSync(pastaAssets).filter((nome) =>
          /\.(js|css)$/u.test(nome),
        );
        expectDeArquivo(arquivosDeAssets.length).toBeGreaterThan(0);
        for (const arquivo of arquivosDeAssets) {
          expectDeArquivo(urlsPrecacheadas).toContain(`assets/${arquivo}`);
        }

        for (const arquivo of [
          'icones/icone-192.png',
          'icones/icone-512.png',
          'icones/icone-maskable-512.png',
          'icones/apple-touch-icon-180.png',
          'icones/icone.svg',
        ]) {
          expectDeArquivo(urlsPrecacheadas).toContain(arquivo);
        }
      } finally {
        rmSync(pastaDeSaida, { recursive: true, force: true });
      }
    },
  );
});

// ---------------------------------------------------------------------------
// Critério 9: nada de dado do usuário no cache do service worker (só Chromium).
// ---------------------------------------------------------------------------

test.describe('nada de dado do usuário no cache do service worker (critério 9, só Chromium)', () => {
  test('depois de importar/exportar offline, todas as URLs em cache são da própria origem e existem em dist/', async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'android-chromium',
      'Cache do service worker só é inspecionado em Chromium (D3/pendência 10).',
    );
    if (!baseURL) throw new Error('baseURL não configurada em playwright.config.ts.');

    const dados = new PaginaDados(page);
    await dados.abrir();
    await page.evaluate(() => navigator.serviceWorker.ready);

    await context.setOffline(true);
    await dados.escolherArquivoParaImportar(CAMINHO_DA_FIXTURE);
    await expect(dados.resumoImportacao).toBeVisible();
    await dados.botaoConfirmarImportacao.click();
    await expect(dados.avisoDeSucessoImportacao).toBeVisible();
    await page.reload();
    await expect(dados.titulo).toBeVisible();
    await context.setOffline(false);

    const urlsEmCache = await page.evaluate(async () => {
      const nomesDeCache = await caches.keys();
      const urls: string[] = [];
      for (const nome of nomesDeCache) {
        const cache = await caches.open(nome);
        const requisicoes = await cache.keys();
        urls.push(...requisicoes.map((r) => r.url));
      }
      return urls;
    });

    expect(urlsEmCache.length).toBeGreaterThan(0);

    const origemEsperada = new URL(baseURL).origin;
    const arquivosDoDist = new Set(
      listarArquivosRecursivo(path.join(RAIZ_DO_REPOSITORIO, 'dist')).map((arquivo) =>
        path.relative(path.join(RAIZ_DO_REPOSITORIO, 'dist'), arquivo).split(path.sep).join('/'),
      ),
    );

    for (const url of urlsEmCache) {
      const urlAnalisada = new URL(url);
      expect(urlAnalisada.origin, url).toBe(origemEsperada);
      const caminhoRelativo = decodeURIComponent(urlAnalisada.pathname).replace(/^\//u, '');
      const caminhoOuIndex = caminhoRelativo === '' ? 'index.html' : caminhoRelativo;
      expect(arquivosDoDist.has(caminhoOuIndex), url).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Critério 10: sem rede para fora, nos dois projetos.
// ---------------------------------------------------------------------------

test.describe('sem rede para fora (critério 10)', () => {
  test('toda requisição de / até abrir /dados tem a mesma origem do baseURL', async ({
    page,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('baseURL não configurada em playwright.config.ts.');
    const origensObservadas = new Set<string>();
    page.on('request', (requisicao) => origensObservadas.add(new URL(requisicao.url()).origin));

    const hoje = new PaginaHoje(page);
    await hoje.abrir();
    await hoje.navegarParaDados();
    await expect(page).toHaveURL(/\/dados$/);

    const origemEsperada = new URL(baseURL).origin;
    expect([...origensObservadas]).toEqual([origemEsperada]);
  });
});

// ---------------------------------------------------------------------------
// Critério 11: armazenamento persistente pedido, nos dois projetos.
// ---------------------------------------------------------------------------

interface JanelaComEspiaoDePersist {
  __persistApiExisted?: boolean;
  __persistCalls?: number;
}

test.describe('armazenamento persistente é pedido (critério 11)', () => {
  test('abrir / chama navigator.storage.persist() exatamente 1 vez quando a API existe; senão, só confere que a página carregou', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const janela = window as unknown as JanelaComEspiaoDePersist;
      janela.__persistApiExisted = typeof navigator.storage?.persist === 'function';
      janela.__persistCalls = 0;
      if (janela.__persistApiExisted) {
        // `Object.defineProperty` em vez de atribuição simples: em alguns
        // motores (ex.: WebKit), `navigator.storage.persist = fn` falha
        // silenciosamente (modo non-strict) porque a propriedade herdada não
        // é gravável por atribuição direta, mesmo sendo configurável.
        const original = navigator.storage.persist.bind(navigator.storage);
        Object.defineProperty(navigator.storage, 'persist', {
          configurable: true,
          value: (...args: Parameters<typeof original>) => {
            janela.__persistCalls = (janela.__persistCalls ?? 0) + 1;
            return original(...args);
          },
        });
      }
    });

    const hoje = new PaginaHoje(page);
    await hoje.abrir();
    await expect(hoje.raiz).not.toBeEmpty();

    const apiExistia = await page.evaluate(
      () => (window as unknown as JanelaComEspiaoDePersist).__persistApiExisted,
    );

    if (apiExistia) {
      // `expect.poll`, não uma leitura única: `solicitarArmazenamentoPersistente()`
      // é disparado sem `await` por `main.tsx` (`void ...().catch(...)`), então
      // a chamada real a `persist()` pode terminar de se refletir no DOM alguns
      // instantes depois de `#root` deixar de estar vazio, especialmente sob
      // carga (suíte inteira em paralelo).
      await expect
        .poll(() =>
          page.evaluate(() => (window as unknown as JanelaComEspiaoDePersist).__persistCalls),
        )
        .toBe(1);
    } else {
      // Sem a API neste navegador: só confere que a página carregou sem erro.
      const chamadas = await page.evaluate(
        () => (window as unknown as JanelaComEspiaoDePersist).__persistCalls,
      );
      expect(chamadas).toBe(0);
    }
  });

  test('navigator.storage.persist() lançando erro não quebra o app nem produz console.error (só console.warn)', async ({
    page,
  }) => {
    const avisos: string[] = [];
    page.on('console', (mensagem) => {
      if (mensagem.type() === 'warning') avisos.push(mensagem.text());
    });

    await page.addInitScript(() => {
      const lancarErro = () => {
        throw new Error('falha simulada de teste (critério 11)');
      };
      if (typeof navigator.storage?.persist === 'function') {
        // Redefine só `persist` no objeto já existente (mesma técnica do
        // teste anterior, que funciona nos dois motores); mexer no objeto
        // `navigator.storage` inteiro é mais arriscado (a propriedade
        // `storage` do `Navigator` pode não ser configurável).
        Object.defineProperty(navigator.storage, 'persist', {
          configurable: true,
          value: lancarErro,
        });
      } else {
        // Sem a API real neste navegador: cria um objeto mínimo só para
        // este teste poder forçar o caminho de erro de qualquer forma.
        Object.defineProperty(navigator, 'storage', {
          configurable: true,
          value: { persist: lancarErro },
        });
      }
    });

    const hoje = new PaginaHoje(page);
    await hoje.abrir();
    await expect(hoje.raiz).not.toBeEmpty();

    // A guarda de console.error de `./fixtures/base` já falharia o teste se
    // a rejeição não tivesse sido tratada; aqui confirmamos que ELA existe
    // como aviso (console.warn), não silêncio total. `expect.poll`: o evento
    // de console pode chegar um instante depois de `#root` deixar de estar
    // vazio (mesmo motivo do teste anterior).
    await expect.poll(() => avisos.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Critério 12: aviso de atualização não aparece à toa, nos dois projetos.
// ---------------------------------------------------------------------------

test.describe('aviso de atualização não aparece à toa (critério 12)', () => {
  test('/ numa carga normal não mostra a mensagem nem o botão "Atualizar agora"', async ({
    page,
  }) => {
    const hoje = new PaginaHoje(page);
    await hoje.abrir();

    await expect(page.getByText(textos.comum.atualizacao.mensagem)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: textos.comum.atualizacao.atualizarAgora }),
    ).toHaveCount(0);
  });

  test('/dados numa carga normal não mostra a mensagem nem o botão "Atualizar agora"', async ({
    page,
  }) => {
    const dados = new PaginaDados(page);
    await dados.abrir();

    await expect(page.getByText(textos.comum.atualizacao.mensagem)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: textos.comum.atualizacao.atualizarAgora }),
    ).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Critério 14: fronteiras intactas (checagem estática, complementa o ESLint).
// ---------------------------------------------------------------------------

testeDeArquivo.describe('fronteiras intactas (critério 14)', () => {
  testeDeArquivo('src/app/** não importa "@/persistencia" (fora de comentário/teste)', () => {
    const arquivos = listarArquivosRecursivo(path.join(RAIZ_DO_REPOSITORIO, 'src', 'app')).filter(
      (arquivo) =>
        /\.(ts|tsx)$/u.test(arquivo) &&
        !arquivo.endsWith('.test.ts') &&
        !arquivo.endsWith('.test.tsx'),
    );
    const comImportProibido = arquivos.filter((arquivo) => {
      const conteudo = readFileSync(arquivo, 'utf-8');
      return /from\s+['"]@\/persistencia/u.test(conteudo);
    });
    expectDeArquivo(comImportProibido).toEqual([]);
  });

  testeDeArquivo('só useAtualizacaoDoApp.ts importa "virtual:pwa-register/react"', () => {
    // Regex de IMPORT de verdade (não `.includes`): o próprio comentário
    // deste ADR em `AvisoDeAtualizacao.test.tsx` cita a string entre crases
    // como texto, sem importar nada — um `.includes` simples daria falso
    // positivo nesse arquivo.
    const arquivos = listarArquivosRecursivo(path.join(RAIZ_DO_REPOSITORIO, 'src')).filter(
      (arquivo) => /\.(ts|tsx)$/u.test(arquivo),
    );
    const padraoDeImport = /from\s+['"]virtual:pwa-register\/react['"]/u;
    const comImporte = arquivos.filter((arquivo) =>
      padraoDeImport.test(readFileSync(arquivo, 'utf-8')),
    );
    expectDeArquivo(comImporte.map((a) => path.relative(RAIZ_DO_REPOSITORIO, a))).toEqual([
      path.join('src', 'app', 'atualizacao', 'useAtualizacaoDoApp.ts'),
    ]);
  });

  testeDeArquivo('src/i18n/** não importa React nem DOM', () => {
    const arquivos = listarArquivosRecursivo(path.join(RAIZ_DO_REPOSITORIO, 'src', 'i18n')).filter(
      (arquivo) => /\.(ts|tsx)$/u.test(arquivo),
    );
    const comReactOuDom = arquivos.filter((arquivo) => {
      const conteudo = readFileSync(arquivo, 'utf-8');
      return (
        /from\s+['"]react(-dom)?(\/[^'"]*)?['"]/u.test(conteudo) ||
        /\bdocument\./u.test(conteudo) ||
        /\bwindow\./u.test(conteudo)
      );
    });
    expectDeArquivo(comReactOuDom).toEqual([]);
  });

  testeDeArquivo('nenhum "eslint-disable" novo em src/ (ADR 0007 não introduz nenhum)', () => {
    const arquivos = listarArquivosRecursivo(path.join(RAIZ_DO_REPOSITORIO, 'src')).filter(
      (arquivo) => /\.(ts|tsx|css)$/u.test(arquivo),
    );
    const comDisable = arquivos.filter((arquivo) =>
      readFileSync(arquivo, 'utf-8').includes('eslint-disable'),
    );
    expectDeArquivo(comDisable).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Critério 15 (acessibilidade) já é coberto por `e2e/acessibilidade.spec.ts`:
// a tela "hoje" daquele arquivo já abre "/" via `PaginaHoje.abrir()`, e
// "dados" já abre "/dados" (herdado do item 0.6). Nada a acrescentar aqui.
