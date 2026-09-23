import { textos } from '@/i18n';
import estilos from './CartaoEstudos.module.css';

/**
 * Conteúdo do cartão de estudos na Hoje (ADR 0009, seção 3): só o `<p>`,
 * sem `<section>` nem `<h2>` — a moldura da Hoje desenha os dois. Substituído
 * pelo conteúdo real nos itens 2.6 e 3.6.
 */
export function CartaoEstudos() {
  return <p className={estilos['texto']}>{textos.estudos.hoje.emBreve}</p>;
}
