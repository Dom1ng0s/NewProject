/**
 * Salvar e ler arquivo no navegador (ADR 0006, seção 7.5). Camada de
 * interface: `src/compartilhado/**` roda sem DOM por configuração do
 * ESLint, então este helper não pode morar lá.
 *
 * `salvarArquivo` tem dois caminhos:
 * 1. App instalado (`display-mode: standalone` ou `navigator.standalone`) e
 *    `navigator.canShare({ files })` → `navigator.share({ files })`. É o
 *    único caminho que funciona no iPhone instalado (o Safari ignora
 *    `<a download>` em modo standalone).
 * 2. Caso contrário → `<a href download>` anexado ao DOM, clicado e
 *    removido, com `URL.revokeObjectURL` no tique seguinte. É o caminho
 *    determinístico que o Playwright observa como evento `download`.
 *
 * `AbortError` do `share` (usuário fechou a folha) vira `'cancelado'`;
 * qualquer outra falha vira `'precisaDeNovoToque'`, e a tela repete o
 * salvamento com o conteúdo já em memória (nunca remonta o arquivo).
 */
export interface ArquivoParaSalvar {
  readonly nome: string;
  readonly tipoMime: string;
  readonly conteudo: string;
}

export type ResultadoDeSalvar = 'salvo' | 'cancelado' | 'precisaDeNovoToque';

/** iOS/iPadOS expõe `navigator.standalone`, fora do padrão DOM do TypeScript. */
interface NavegadorComStandalone extends Navigator {
  readonly standalone?: boolean;
}

function appEstaInstalado(): boolean {
  const emModoStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const standaloneDoIos = (navigator as NavegadorComStandalone).standalone === true;
  return emModoStandalone || standaloneDoIos;
}

function baixarViaLink(arquivo: ArquivoParaSalvar, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = arquivo.nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export async function salvarArquivo(arquivo: ArquivoParaSalvar): Promise<ResultadoDeSalvar> {
  const blob = new Blob([arquivo.conteudo], { type: arquivo.tipoMime });
  const arquivoCompartilhavel = new File([blob], arquivo.nome, { type: arquivo.tipoMime });

  if (appEstaInstalado() && navigator.canShare?.({ files: [arquivoCompartilhavel] })) {
    try {
      await navigator.share({ files: [arquivoCompartilhavel] });
      return 'salvo';
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === 'AbortError') {
        return 'cancelado';
      }
      return 'precisaDeNovoToque';
    }
  }

  try {
    baixarViaLink(arquivo, blob);
    return 'salvo';
  } catch {
    return 'precisaDeNovoToque';
  }
}

export async function lerTextoDeArquivo(arquivo: File): Promise<string> {
  return arquivo.text();
}
