import type { Download, Locator, Page, Response } from '@playwright/test';
import { textos } from '@/i18n';

const t = textos.nucleo.dados;

/** Page object da tela `/dados` (ADR 0006, seção 7). */
export class PaginaDados {
  static readonly caminho = '/dados';

  readonly pagina: Page;
  readonly titulo: Locator;

  // Backup completo (JSON).
  readonly botaoExportarBackup: Locator;

  // Importar.
  readonly campoImportarArquivo: Locator;
  readonly resumoImportacao: Locator;
  readonly botaoConfirmarImportacao: Locator;
  readonly botaoCancelarImportacao: Locator;
  readonly avisoDeSucessoImportacao: Locator;

  // Apagar tudo.
  readonly botaoApagarTudoInicial: Locator;
  readonly tituloDaConfirmacaoApagar: Locator;
  readonly campoConfirmacaoApagar: Locator;
  readonly botaoApagarTudoAgora: Locator;
  readonly botaoCancelarApagar: Locator;
  readonly avisoDeSucessoApagar: Locator;

  // Erros: qualquer bloco role="alert" na página.
  readonly alertaDeErro: Locator;

  constructor(page: Page) {
    this.pagina = page;
    this.titulo = page.getByRole('heading', { level: 1, name: t.titulo });

    this.botaoExportarBackup = page.getByRole('button', { name: t.backup.botaoExportar });

    this.campoImportarArquivo = page.getByLabel(t.importar.rotuloArquivo);
    this.resumoImportacao = page.getByRole('heading', { name: t.importar.resumoTitulo });
    this.botaoConfirmarImportacao = page.getByRole('button', { name: t.importar.botaoConfirmar });
    this.botaoCancelarImportacao = page.getByRole('button', { name: t.importar.botaoCancelar });
    this.avisoDeSucessoImportacao = page
      .getByRole('status')
      .filter({ hasText: t.importar.sucesso });

    this.botaoApagarTudoInicial = page.getByRole('button', {
      name: t.apagarTudo.titulo,
      exact: true,
    });
    this.tituloDaConfirmacaoApagar = page.getByRole('heading', {
      level: 3,
      name: t.apagarTudo.titulo,
    });
    this.campoConfirmacaoApagar = page.getByLabel(t.apagarTudo.rotuloConfirmacao);
    this.botaoApagarTudoAgora = page.getByRole('button', { name: t.apagarTudo.botaoConfirmar });
    this.botaoCancelarApagar = page.getByRole('button', { name: t.apagarTudo.botaoCancelar });
    this.avisoDeSucessoApagar = page.getByRole('status').filter({ hasText: t.apagarTudo.sucesso });

    this.alertaDeErro = page.getByRole('alert');
  }

  /** Primeiro parágrafo "Sem dados para exportar ainda." visível na página (qualquer módulo). */
  get textoCsvSemDados(): Locator {
    return this.pagina.getByText(t.csv.semDados).first();
  }

  /** Primeiro botão "Baixar …csv" visível na página (qualquer módulo/arquivo). */
  get primeiroBotaoBaixarCsv(): Locator {
    return this.pagina.getByRole('button', { name: /^Baixar /u }).first();
  }

  async abrir(): Promise<Response> {
    const resposta = await this.pagina.goto(PaginaDados.caminho);
    if (!resposta) {
      throw new Error('Navegar para /dados nao retornou resposta HTTP.');
    }
    await this.titulo.waitFor({ state: 'visible' });
    return resposta;
  }

  botaoPrepararCsv(nomeDoModulo: string): Locator {
    return this.pagina.getByRole('button', { name: t.csv.botaoPreparar(nomeDoModulo) });
  }

  botaoBaixarCsv(nomeDoArquivoComData: string): Locator {
    return this.pagina.getByRole('button', { name: t.csv.botaoBaixar(nomeDoArquivoComData) });
  }

  /** Clica um botão que dispara `salvarArquivo` e devolve o evento de download do Playwright. */
  async clicarEBaixar(botao: Locator): Promise<Download> {
    const [download] = await Promise.all([this.pagina.waitForEvent('download'), botao.click()]);
    return download;
  }

  async escolherArquivoParaImportar(
    caminhoOuBuffer: Parameters<Locator['setInputFiles']>[0],
  ): Promise<void> {
    await this.campoImportarArquivo.setInputFiles(caminhoOuBuffer);
  }
}
