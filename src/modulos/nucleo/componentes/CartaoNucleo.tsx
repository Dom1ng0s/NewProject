import { textos } from '@/i18n';

/**
 * Placeholder do cartão do núcleo na tela Hoje (item 0.2, scaffolding).
 * O conteúdo real (configurações, backup, XP) chega nos itens 0.10 a 0.12 e na Fase 5.
 */
export function CartaoNucleo() {
  return <p>{textos.nucleo.hoje.tituloDoCartao}</p>;
}
