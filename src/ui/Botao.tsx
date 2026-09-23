import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

export type VarianteDoBotao = 'primario' | 'secundario' | 'destrutivo';

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variante?: VarianteDoBotao;
}

/**
 * Botão nativo (`<button>`) com alvo de toque mínimo de 44×44px (token
 * `--alvo-minimo`, ADR 0006 seção 7.6). `type="button"` por padrão: nenhum
 * botão desta tela deve submeter um `<form>` sem querer. Encaminha `ref`
 * (mesmo padrão de `Aviso`) para os fluxos que precisam mover o foco por
 * código depois que um botão troca de posição no DOM.
 */
export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(
  { variante = 'primario', type = 'button', className, ...props },
  ref,
) {
  const classes = ['botao', `botao--${variante}`, className].filter(Boolean).join(' ');
  return <button ref={ref} type={type} className={classes} {...props} />;
});
