/**
 * E2e de Finanças (itens 1.1/1.2/1.6 do plano): gasto em 3 toques a partir da
 * Hoje (pendência 5 do plano: abrir o lançamento, digitar o valor, tocar na
 * categoria que salva), disponível hoje (regra 7.3) recalculado após lançar e
 * após excluir, e título de página por tela nova (pendência 69).
 *
 * Relógio fixo (`page.clock.setFixedTime`) em todos os testes: o cálculo do
 * disponível hoje depende do dia do mês (regra 7.3), então nunca pode
 * depender do dia em que a suíte roda de verdade (mesmo padrão de
 * `e2e/dados.spec.ts`).
 */
import { NOME_DO_APP, textos } from '@/i18n';
import { test, expect } from './fixtures/base';
import { PaginaHoje } from './paginas/hoje';
import { PaginaConfiguracoes } from './paginas/configuracoes';
import { PaginaEditarLancamento, PaginaFinancas, PaginaNovoLancamento } from './paginas/financas';
import { verificarAcessibilidade } from './utilitarios/acessibilidade';

// 2026-04-15 em America/Sao_Paulo (UTC-3): mês de 30 dias, dia 15 -> faltam
// 16 dias (incluindo hoje) até o fim do mês.
const AGORA_FIXO = '2026-04-15T15:00:00.000Z';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AGORA_FIXO);
});

test.describe('gasto em 3 toques a partir da Hoje (ESPECIFICACAO §6.2, pendência 5 do plano)', () => {
  test('tocar o atalho "Gasto", digitar o valor e tocar numa categoria salva o lançamento', async ({
    page,
  }) => {
    const hoje = new PaginaHoje(page);
    await hoje.abrir();

    // Toque 1: atalho "Gasto" na área "Registrar agora" da Hoje.
    await hoje.atalhoDeGasto.click();

    const novoLancamento = new PaginaNovoLancamento(page);
    await expect(novoLancamento.tituloGasto).toBeVisible();
    await expect(page).toHaveTitle(
      textos.comum.tituloDaPagina(textos.financas.novoLancamento.tituloGasto),
    );
    // O campo de valor já vem focado, com teclado numérico (D9/item 1.1).
    await expect(novoLancamento.campoValor).toBeFocused();
    await expect(novoLancamento.campoValor).toHaveAttribute('inputmode', 'decimal');

    // Toque 2: digitar o valor.
    await novoLancamento.campoValor.fill('25,90');

    // Toque 3: tocar numa categoria — salva na hora, sem toque extra.
    await novoLancamento.categoria('Alimentação').click();

    await expect(page).toHaveURL(/\/financas$/);
    const financas = new PaginaFinancas(page);
    await expect(financas.titulo).toBeVisible();
    await expect(page.getByText('R$ 25,90')).toBeVisible();
    await expect(page.getByText('Alimentação')).toBeVisible();
  });

  test('categorias desabilitadas até o valor ser válido (o toque na categoria não pode salvar lançamento inválido)', async ({
    page,
  }) => {
    await page.goto(PaginaNovoLancamento.caminho);
    const novoLancamento = new PaginaNovoLancamento(page);
    await expect(novoLancamento.tituloGasto).toBeVisible();

    await expect(novoLancamento.categoria('Alimentação')).toBeDisabled();
    await novoLancamento.campoValor.fill('0');
    await expect(novoLancamento.categoria('Alimentação')).toBeDisabled();
    await novoLancamento.campoValor.fill('10,00');
    await expect(novoLancamento.categoria('Alimentação')).toBeEnabled();
  });
});

test.describe('disponível hoje recalcula após lançar e após excluir (regra 7.3, critério de aceite)', () => {
  test('registrar um gasto reduz o disponível de hoje; excluir o lançamento devolve o valor original', async ({
    page,
  }) => {
    const configuracoes = new PaginaConfiguracoes(page);
    await configuracoes.abrir();
    await configuracoes.campoOrcamento.fill('1600,00');
    await configuracoes.confirmarComTab();
    await expect(configuracoes.status).toHaveText(/Orçamento salvo/u);

    const hoje = new PaginaHoje(page);
    await hoje.abrir();
    // orçamento 1600,00; faltam 16 dias (incluindo hoje) -> cota diária 100,00.
    await expect(hoje.disponivelHojeNoCartao).toHaveText('Disponível hoje: R$ 100,00');

    await hoje.atalhoDeGasto.click();
    const novoLancamento = new PaginaNovoLancamento(page);
    await expect(novoLancamento.tituloGasto).toBeVisible();
    await novoLancamento.campoValor.fill('40,00');
    await novoLancamento.categoria('Alimentação').click();

    const financas = new PaginaFinancas(page);
    await expect(financas.titulo).toBeVisible();

    await hoje.linkDeNavegacaoHoje.click();
    await expect(hoje.titulo).toBeVisible();
    await expect(hoje.disponivelHojeNoCartao).toHaveText('Disponível hoje: R$ 60,00');

    // Exclui o lançamento recém-criado a partir da lista de Finanças.
    await financas.abrir();
    await financas.linkEditarDoLancamento('Alimentação').click();
    const editar = new PaginaEditarLancamento(page);
    await expect(editar.titulo).toBeVisible();
    await expect(page).toHaveTitle(
      textos.comum.tituloDaPagina(textos.financas.editar.tituloDaPagina),
    );
    await editar.botaoExcluir.click();

    await expect(financas.titulo).toBeVisible();
    await hoje.linkDeNavegacaoHoje.click();
    await expect(hoje.titulo).toBeVisible();
    await expect(hoje.disponivelHojeNoCartao).toHaveText('Disponível hoje: R$ 100,00');
  });
});

test.describe('título de página por tela (pendência 69 do plano)', () => {
  test('Finanças e Categorias têm título de página próprio', async ({ page }) => {
    const financas = new PaginaFinancas(page);
    await financas.abrir();
    await expect(page).toHaveTitle(textos.comum.tituloDaPagina(textos.financas.pagina.titulo));

    await financas.linkCategorias.click();
    await expect(page).toHaveTitle(textos.comum.tituloDaPagina(textos.financas.categorias.titulo));
  });

  test('a Hoje continua com só o nome do app (sem mudar por causa do atalho novo)', async ({
    page,
  }) => {
    const hoje = new PaginaHoje(page);
    await hoje.abrir();
    await expect(page).toHaveTitle(NOME_DO_APP);
  });
});

test.describe('acessibilidade da tela de editar lançamento (pendência 68 do plano)', () => {
  test('sem violação WCAG 2.2 AA + best-practice: financas-editar-lancamento', async ({
    page,
  }, info) => {
    // Precisa de um lançamento real para abrir a tela de edição.
    await page.goto(PaginaNovoLancamento.caminho);
    const novoLancamento = new PaginaNovoLancamento(page);
    await expect(novoLancamento.tituloGasto).toBeVisible();
    await novoLancamento.campoValor.fill('15,00');
    await novoLancamento.categoria('Alimentação').click();

    const financas = new PaginaFinancas(page);
    await expect(financas.titulo).toBeVisible();
    await financas.linkEditarDoLancamento('Alimentação').click();

    const editar = new PaginaEditarLancamento(page);
    await expect(editar.titulo).toBeVisible();
    await verificarAcessibilidade(page, info, 'financas-editar-lancamento');
  });
});
