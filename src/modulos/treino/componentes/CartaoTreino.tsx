import { textos } from '@/i18n';
import estilos from './CartaoTreino.module.css';

/**
 * Conteúdo do cartão de treino na Hoje (ADR 0009, seção 3): só o `<p>`,
 * sem `<section>` nem `<h2>` — a moldura da Hoje desenha os dois. Substituído
 * pelo conteúdo real no item 1.10.
 */
export function CartaoTreino() {
  return <p className={estilos['texto']}>{textos.treino.hoje.emBreve}</p>;
}
