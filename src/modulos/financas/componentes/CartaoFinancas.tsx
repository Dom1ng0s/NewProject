import { textos } from '@/i18n';
import estilos from './CartaoFinancas.module.css';

/**
 * Conteúdo do cartão de finanças na Hoje (ADR 0009, seção 3): só o `<p>`,
 * sem `<section>` nem `<h2>` — a moldura da Hoje desenha os dois. Substituído
 * pelo conteúdo real no item 4.6.
 */
export function CartaoFinancas() {
  return <p className={estilos['texto']}>{textos.financas.hoje.emBreve}</p>;
}
