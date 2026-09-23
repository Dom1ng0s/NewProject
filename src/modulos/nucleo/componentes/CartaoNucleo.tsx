import { textos } from '@/i18n';
import estilos from './CartaoNucleo.module.css';

/**
 * Conteúdo do cartão do núcleo na Hoje (ADR 0009, seção 3): só o `<p>`,
 * sem `<section>` nem `<h2>` — a moldura da Hoje desenha os dois. Placeholder
 * até o item 5.2 decidir se o cartão continua existindo.
 */
export function CartaoNucleo() {
  return <p className={estilos['texto']}>{textos.nucleo.hoje.emBreve}</p>;
}
