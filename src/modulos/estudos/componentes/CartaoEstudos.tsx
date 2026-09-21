import { textos } from '@/i18n';

/**
 * Placeholder do cartão de estudos na tela Hoje (item 0.2, scaffolding).
 * O cartão real agrega foco e flashcards a partir da Fase 2/3. Pasta criada
 * fora da árvore literal do ADR 0002 (que só lista `foco/componentes` e
 * `flashcards/componentes`) para manter o `index.ts` do módulo livre de JSX.
 */
export function CartaoEstudos() {
  return <p>{textos.estudos.hoje.tituloDoCartao}</p>;
}
