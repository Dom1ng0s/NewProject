/**
 * E2e da tela `/dados` (ADR 0006, seção 9, critérios 18-23). Relógio
 * controlado via `page.clock.setFixedTime` (nunca a data real do dia em que
 * a suíte roda), porque o nome do arquivo exportado embute "hoje".
 *
 * NUNCA importar `@/modulos/nucleo` aqui: o barrel do módulo reexporta a
 * tela `Dados.tsx`, que importa um `.module.css` — e o runner do Playwright
 * (Node puro, sem o pipeline do Vite) não sabe transformar CSS. Os nomes de
 * arquivo esperados (`nomeDoArquivoDeBackup`/`nomeDoArquivoCsv`, ADR 0006
 * seção 2.5) são literais fixos aqui de propósito: o critério 17 já prova a
 * função pura no unitário (`dominio/backup/nomes.test.ts`); este e2e prova
 * só o comportamento observável pelo usuário.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Download, Locator } from '@playwright/test';
import { textos } from '@/i18n';
import { test, expect } from './fixtures/base';
import { PaginaHoje } from './paginas/hoje';
import { PaginaDados } from './paginas/dados';

const t = textos.nucleo.dados;

const DIRETORIO_DESTE_ARQUIVO = path.dirname(fileURLToPath(import.meta.url));
const CAMINHO_DA_FIXTURE = path.join(DIRETORIO_DESTE_ARQUIVO, 'fixtures', 'backup-exemplo.json');

// Relógio fixo para todos os testes deste arquivo: "hoje" nunca é o dia em
// que a suíte roda de verdade (nome do arquivo exportado embute a data).
const AGORA_FIXO = '2026-09-23T15:00:00.000Z'; // 12:00 em America/Sao_Paulo (UTC-3)
const HOJE_LOCAL = '2026-09-23';
const NOME_DO_BACKUP_ESPERADO = `app-rotina-backup-${HOJE_LOCAL}.json`;
const NOME_DO_CSV_DE_HISTORICO_ESPERADO = `nucleo-historico-de-acoes-${HOJE_LOCAL}.csv`;

async function lerTextoDoDownload(download: Download): Promise<string> {
  const caminho = await download.path();
  if (!caminho) throw new Error('Download sem caminho local (Playwright não salvou o arquivo).');
  return readFile(caminho, 'utf-8');
}

function semGeradoEm(arquivo: Record<string, unknown>): Record<string, unknown> {
  const metadados = arquivo['metadados'];
  if (typeof metadados !== 'object' || metadados === null) return arquivo;
  return { ...arquivo, metadados: { ...metadados, geradoEm: 'IGNORADO' } };
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AGORA_FIXO);
});

test('abre /dados a partir de um link na Hoje (critério 18, passo 1)', async ({ page }) => {
  const hoje = new PaginaHoje(page);
  await hoje.abrir();

  await hoje.navegarParaDados();

  await expect(page).toHaveURL(/\/dados$/);
  const dados = new PaginaDados(page);
  await expect(dados.titulo).toBeVisible();
});

test('fluxo crítico completo: importar, revisar resumo, confirmar, exportar e comparar, baixar CSV, apagar tudo e sobreviver ao reload (critério 18)', async ({
  page,
}) => {
  const dados = new PaginaDados(page);
  await dados.abrir();

  const textoDaFixture = await readFile(CAMINHO_DA_FIXTURE, 'utf-8');
  const fixtureJson = JSON.parse(textoDaFixture) as Record<string, unknown>;

  await test.step('importar a fixture e conferir o resumo ANTES de confirmar', async () => {
    await dados.escolherArquivoParaImportar(CAMINHO_DA_FIXTURE);
    await expect(dados.resumoImportacao).toBeVisible();
    // 1 configuração + 2 ações (inclusive a soft-deleted) = 3 registros no total.
    await expect(page.getByText(t.importar.resumoTotalDeRegistros(3))).toBeVisible();
    // Ainda NÃO confirmado: nada deve ter mudado no banco ainda.
    await expect(dados.botaoConfirmarImportacao).toBeVisible();
  });

  await test.step('confirmar a importação', async () => {
    await dados.botaoConfirmarImportacao.click();
    await expect(dados.avisoDeSucessoImportacao).toBeVisible();
  });

  await test.step('exportar o backup e comparar com a fixture (ignorando geradoEm)', async () => {
    const download = await dados.clicarEBaixar(dados.botaoExportarBackup);
    expect(download.suggestedFilename()).toBe(NOME_DO_BACKUP_ESPERADO);

    const textoExportado = await lerTextoDoDownload(download);
    const exportadoJson = JSON.parse(textoExportado) as Record<string, unknown>;
    expect(semGeradoEm(exportadoJson)).toEqual(semGeradoEm(fixtureJson));
  });

  await test.step('baixar um CSV e conferir o cabeçalho', async () => {
    await dados.botaoPrepararCsv(t.nomesDeModulo.nucleo).click();
    const nomeComData = NOME_DO_CSV_DE_HISTORICO_ESPERADO;
    const download = await dados.clicarEBaixar(dados.botaoBaixarCsv(nomeComData));
    expect(download.suggestedFilename()).toBe(nomeComData);

    const conteudo = await lerTextoDoDownload(download);
    const semBom = conteudo.replace(/^\uFEFF/, '');
    const [cabecalho, ...linhas] = semBom.split('\r\n').filter(Boolean);
    expect(cabecalho).toBe('id;createdAt;ocorridaEm;dia;modulo;tipo;quantidade;referenciaId');
    // Só a ação ativa da fixture (a outra é soft-deleted e não entra no CSV).
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toContain('018f4c9a-0000-7000-8000-000000000001');
  });

  await test.step('apagar tudo com a palavra APAGAR', async () => {
    await dados.botaoApagarTudoInicial.click();
    await expect(dados.tituloDaConfirmacaoApagar).toBeVisible();
    await dados.campoConfirmacaoApagar.fill('APAGAR');
    await expect(dados.botaoApagarTudoAgora).toBeEnabled();
    await dados.botaoApagarTudoAgora.click();
    await expect(dados.avisoDeSucessoApagar).toBeVisible();
  });

  await test.step('recarregar a página e confirmar que todas as tabelas ficaram vazias', async () => {
    await page.reload();
    await expect(dados.titulo).toBeVisible();

    const download = await dados.clicarEBaixar(dados.botaoExportarBackup);
    const textoExportado = await lerTextoDoDownload(download);
    const exportadoJson = JSON.parse(textoExportado) as {
      modulos: { nucleo: { configuracoes: unknown[]; historicoDeAcoes: unknown[] } };
    };
    expect(exportadoJson.modulos.nucleo.configuracoes).toEqual([]);
    expect(exportadoJson.modulos.nucleo.historicoDeAcoes).toEqual([]);
  });
});

test.describe('caminho de erro (critério 19)', () => {
  test('JSON malformado mostra role=alert e não altera o banco', async ({ page }) => {
    const dados = new PaginaDados(page);
    await dados.abrir();

    const antes = await dados.clicarEBaixar(dados.botaoExportarBackup);
    const textoAntes = semGeradoEm(
      JSON.parse(await lerTextoDoDownload(antes)) as Record<string, unknown>,
    );

    await dados.escolherArquivoParaImportar({
      name: 'invalido.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ isto nao é um json valido', 'utf-8'),
    });

    await expect(dados.alertaDeErro).toBeVisible();
    await expect(dados.alertaDeErro).toContainText(t.erros.jsonInvalido);

    const depois = await dados.clicarEBaixar(dados.botaoExportarBackup);
    const textoDepois = semGeradoEm(
      JSON.parse(await lerTextoDoDownload(depois)) as Record<string, unknown>,
    );
    expect(textoDepois).toEqual(textoAntes);
  });

  test('backup com versaoDoSchema: 99 mostra role=alert e não altera o banco', async ({ page }) => {
    const dados = new PaginaDados(page);
    await dados.abrir();

    const antes = await dados.clicarEBaixar(dados.botaoExportarBackup);
    const textoAntes = semGeradoEm(
      JSON.parse(await lerTextoDoDownload(antes)) as Record<string, unknown>,
    );

    const backupSchemaFuturo = {
      metadados: {
        formato: 'app-rotina-backup',
        versaoDoFormato: 1,
        versaoDoSchema: 99,
        geradoEm: '2026-01-01T00:00:00.000Z',
      },
      modulos: {},
    };

    await dados.escolherArquivoParaImportar({
      name: 'schema-futuro.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backupSchemaFuturo), 'utf-8'),
    });

    await expect(dados.alertaDeErro).toBeVisible();
    await expect(dados.alertaDeErro).toContainText(t.erros.schemaMaisNovo);

    const depois = await dados.clicarEBaixar(dados.botaoExportarBackup);
    const textoDepois = semGeradoEm(
      JSON.parse(await lerTextoDoDownload(depois)) as Record<string, unknown>,
    );
    expect(textoDepois).toEqual(textoAntes);
  });
});

test.describe('apagar tudo: confirmação (critérios 20 e 21)', () => {
  test('botão "Apagar tudo agora" fica desabilitado com o campo vazio/errado e habilita com variações de APAGAR', async ({
    page,
  }) => {
    const dados = new PaginaDados(page);
    await dados.abrir();
    await dados.botaoApagarTudoInicial.click();

    await expect(dados.botaoApagarTudoAgora).toBeDisabled();

    await dados.campoConfirmacaoApagar.fill('APAGA');
    await expect(dados.botaoApagarTudoAgora).toBeDisabled();

    for (const variacao of ['apagar', 'APAGAR', ' APAGAR ']) {
      await dados.campoConfirmacaoApagar.fill(variacao);
      await expect(dados.botaoApagarTudoAgora).toBeEnabled();
    }
  });

  test('navegação só por teclado até apagar tudo (Tab/Enter/digitação, sem mouse)', async ({
    page,
  }) => {
    const dados = new PaginaDados(page);
    await dados.abrir();

    await dados.botaoApagarTudoInicial.focus();
    await expect(dados.botaoApagarTudoInicial).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(dados.tituloDaConfirmacaoApagar).toBeFocused();

    await page.keyboard.press('Tab'); // h3 (tabIndex=-1) -> campo de confirmação
    await expect(dados.campoConfirmacaoApagar).toBeFocused();
    await page.keyboard.type('APAGAR');

    await page.keyboard.press('Tab'); // campo -> botão "Apagar tudo agora"
    await expect(dados.botaoApagarTudoAgora).toBeFocused();
    await expect(dados.botaoApagarTudoAgora).toBeEnabled();
    await page.keyboard.press('Enter');

    await expect(dados.avisoDeSucessoApagar).toBeVisible();
    await expect(dados.avisoDeSucessoApagar).toBeFocused();
  });

  test('alvo de toque: TODOS os controles de /dados têm pelo menos 44×44px', async ({ page }) => {
    const dados = new PaginaDados(page);
    await dados.abrir();

    async function medir(nome: string, alvo: Locator): Promise<void> {
      const caixa = await alvo.boundingBox();
      if (!caixa) throw new Error(`"${nome}" não tem bounding box (não está visível?).`);
      expect(caixa.width, `${nome}: largura`).toBeGreaterThanOrEqual(44);
      expect(caixa.height, `${nome}: altura`).toBeGreaterThanOrEqual(44);
    }

    // Backup completo (JSON).
    await medir('Exportar backup (JSON)', dados.botaoExportarBackup);

    // CSV por módulo: os quatro botões "Preparar CSV de …", ainda ociosos.
    for (const modulo of ['nucleo', 'treino', 'estudos', 'financas'] as const) {
      await medir(
        `Preparar CSV de ${t.nomesDeModulo[modulo]}`,
        dados.botaoPrepararCsv(t.nomesDeModulo[modulo]),
      );
    }

    // Importar: campo de arquivo (sempre visível) e, depois de escolher a
    // fixture (mas ANTES de confirmar — dois passos, ADR 0006 seção 7.3),
    // os botões "Importar e substituir" e "Cancelar".
    await medir('Campo de arquivo (input type=file)', dados.campoImportarArquivo);
    await dados.escolherArquivoParaImportar(CAMINHO_DA_FIXTURE);
    await expect(dados.resumoImportacao).toBeVisible();
    await medir('Importar e substituir', dados.botaoConfirmarImportacao);
    await medir('Cancelar (importar)', dados.botaoCancelarImportacao);

    await dados.botaoConfirmarImportacao.click();
    await expect(dados.avisoDeSucessoImportacao).toBeVisible();

    // Com dado real no núcleo, gerar o CSV revela os botões "Baixar …csv".
    await dados.botaoPrepararCsv(t.nomesDeModulo.nucleo).click();
    const botoesDeDownload = page.getByRole('button', { name: /^Baixar /u });
    await expect(botoesDeDownload.first()).toBeVisible();
    const quantidadeDeDownloads = await botoesDeDownload.count();
    expect(quantidadeDeDownloads).toBeGreaterThan(0);
    for (let indice = 0; indice < quantidadeDeDownloads; indice += 1) {
      const botao = botoesDeDownload.nth(indice);
      const rotulo = (await botao.textContent()) ?? `Baixar CSV #${String(indice)}`;
      await medir(rotulo, botao);
    }

    // Apagar tudo: botão inicial, e depois de revelar a confirmação, os dois
    // botões e o campo de confirmação.
    await medir('Apagar todos os dados (botão inicial)', dados.botaoApagarTudoInicial);
    await dados.botaoApagarTudoInicial.click();
    await medir('Apagar tudo agora', dados.botaoApagarTudoAgora);
    await medir('Cancelar (apagar tudo)', dados.botaoCancelarApagar);
    await medir('Campo de confirmação', dados.campoConfirmacaoApagar);
  });
});

test.describe('foco movido para a mensagem de resultado (interface, ponto 4)', () => {
  test('confirmar uma importação com sucesso move o foco para a mensagem de resultado', async ({
    page,
  }) => {
    const dados = new PaginaDados(page);
    await dados.abrir();

    await dados.escolherArquivoParaImportar(CAMINHO_DA_FIXTURE);
    await expect(dados.resumoImportacao).toBeVisible();
    await dados.botaoConfirmarImportacao.click();

    await expect(dados.avisoDeSucessoImportacao).toBeVisible();
    await expect(dados.avisoDeSucessoImportacao).toBeFocused();
  });

  test('confirmar uma importação com erro (falha de validação de negócio) move o foco para a mensagem de resultado', async ({
    page,
  }) => {
    const dados = new PaginaDados(page);
    await dados.abrir();

    // Envelope válido (passa por `lerBackup`), mas `tema: "roxo"` é inválido
    // na camada de negócio: o erro só aparece DEPOIS de confirmar, dentro da
    // transação de `importarBackup` — diferente dos dois testes de "caminho
    // de erro" acima, que falham antes mesmo de mostrar o resumo.
    const backupComTemaInvalido = {
      metadados: {
        formato: 'app-rotina-backup',
        versaoDoFormato: 1,
        versaoDoSchema: 1,
        geradoEm: '2026-01-01T00:00:00.000Z',
      },
      modulos: {
        nucleo: {
          configuracoes: [
            {
              id: 'configuracoes-unicas',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              deletedAt: null,
              metaSemanalDeFocoEmMinutos: 300,
              metaSemanalDeTreinos: 3,
              orcamentoMensalEmCentavos: null,
              unidadeDePeso: 'kg',
              tema: 'roxo',
              onboardingConcluidoEm: null,
            },
          ],
          historicoDeAcoes: [],
        },
      },
    };

    await dados.escolherArquivoParaImportar({
      name: 'tema-invalido.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backupComTemaInvalido), 'utf-8'),
    });
    await expect(dados.resumoImportacao).toBeVisible();
    await dados.botaoConfirmarImportacao.click();

    await expect(dados.alertaDeErro).toBeVisible();
    await expect(dados.alertaDeErro).toBeFocused();
  });

  test('preparar CSV com sucesso (módulo com dado) move o foco para o primeiro botão de download', async ({
    page,
  }) => {
    const dados = new PaginaDados(page);
    await dados.abrir();

    // Precisa de dado real no núcleo para a lista de arquivos não ficar vazia.
    await dados.escolherArquivoParaImportar(CAMINHO_DA_FIXTURE);
    await expect(dados.resumoImportacao).toBeVisible();
    await dados.botaoConfirmarImportacao.click();
    await expect(dados.avisoDeSucessoImportacao).toBeVisible();

    await dados.botaoPrepararCsv(t.nomesDeModulo.nucleo).click();

    await expect(dados.primeiroBotaoBaixarCsv).toBeVisible();
    await expect(dados.primeiroBotaoBaixarCsv).toBeFocused();
  });

  test('preparar CSV de um módulo sem dados move o foco para a mensagem "sem dados"', async ({
    page,
  }) => {
    const dados = new PaginaDados(page);
    await dados.abrir();

    await dados.botaoPrepararCsv(t.nomesDeModulo.treino).click();

    await expect(dados.textoCsvSemDados).toBeVisible();
    await expect(dados.textoCsvSemDados).toBeFocused();
  });

  // Preparar CSV com ERRO (estado.fase === 'erro' em SecaoCsvDoModulo) exigiria
  // mockar uma falha de `exportarCsvPorModulo` (ex.: interceptar/derrubar o
  // IndexedDB no meio da chamada) — não há caminho determinístico para
  // provocar isso a partir da UI num e2e real. Fica de fora, registrado no
  // relatório da entrega; o comportamento de foco em si é o mesmo `ref.focus()`
  // já coberto pelos dois casos acima e pelos dois de SecaoImportar.
});

test.describe('estado é preservado ao recarregar (D3)', () => {
  test('recarregar no meio do fluxo de apagar tudo (antes de confirmar) não apaga nada', async ({
    page,
  }) => {
    const dados = new PaginaDados(page);
    await dados.abrir();

    // Importa a fixture primeiro para ter dado real para proteger.
    await dados.escolherArquivoParaImportar(CAMINHO_DA_FIXTURE);
    await expect(dados.resumoImportacao).toBeVisible();
    await dados.botaoConfirmarImportacao.click();
    await expect(dados.avisoDeSucessoImportacao).toBeVisible();

    // Começa "apagar tudo", digita só metade da palavra, e recarrega SEM confirmar.
    await dados.botaoApagarTudoInicial.click();
    await dados.campoConfirmacaoApagar.fill('APAG');
    await page.reload();

    // A tela volta ao estado inicial (o campo digitado era só estado de tela)...
    await expect(dados.titulo).toBeVisible();
    await expect(dados.botaoApagarTudoInicial).toBeVisible();

    // ...e os dados continuam lá: nada foi apagado por causa do reload.
    const download = await dados.clicarEBaixar(dados.botaoExportarBackup);
    const exportado = JSON.parse(await lerTextoDoDownload(download)) as {
      modulos: { nucleo: { configuracoes: unknown[]; historicoDeAcoes: unknown[] } };
    };
    expect(exportado.modulos.nucleo.configuracoes).toHaveLength(1);
    expect(exportado.modulos.nucleo.historicoDeAcoes).toHaveLength(2);
  });
});

test.describe('offline (critério 23, decisão D3/pendência 10: validado em Chromium)', () => {
  test('fluxo de exportar/importar/apagar funciona sem rede depois do primeiro carregamento', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'android-chromium',
      'Offline validado só em Chromium (pendência 10 do docs/PLANO.md); IndexedDB/Blob não fazem rede em nenhum navegador, mas o teste evita duplicar em WebKit.',
    );

    const dados = new PaginaDados(page);
    await dados.abrir(); // primeiro carregamento, com rede

    await context.setOffline(true);

    await dados.escolherArquivoParaImportar(CAMINHO_DA_FIXTURE);
    await expect(dados.resumoImportacao).toBeVisible();
    await dados.botaoConfirmarImportacao.click();
    await expect(dados.avisoDeSucessoImportacao).toBeVisible();

    const download = await dados.clicarEBaixar(dados.botaoExportarBackup);
    const exportado = JSON.parse(await lerTextoDoDownload(download)) as {
      modulos: { nucleo: { configuracoes: unknown[] } };
    };
    expect(exportado.modulos.nucleo.configuracoes).toHaveLength(1);

    await dados.botaoApagarTudoInicial.click();
    await dados.campoConfirmacaoApagar.fill('APAGAR');
    await dados.botaoApagarTudoAgora.click();
    await expect(dados.avisoDeSucessoApagar).toBeVisible();

    await context.setOffline(false);
  });
});
