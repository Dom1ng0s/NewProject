import { forwardRef } from 'react';
import type { ReactNode } from 'react';

export type VarianteDoAviso = 'status' | 'alerta';

export interface AvisoProps {
  readonly variante: VarianteDoAviso;
  readonly children: ReactNode;
  readonly id?: string;
}

/**
 * Feedback de sucesso (`role="status"`, `aria-live="polite"`) ou de erro
 * (`role="alert"`) (ADR 0006, seção 7.6). `tabIndex={-1}` permite mover o
 * foco para a mensagem por código (`ref.current?.focus()`) nos fluxos que o
 * exigem (ex.: conclusão de "apagar tudo").
 */
export const Aviso = forwardRef<HTMLDivElement, AvisoProps>(function Aviso(
  { variante, children, id },
  ref,
) {
  const role = variante === 'status' ? 'status' : 'alert';
  return (
    <div
      ref={ref}
      id={id}
      role={role}
      aria-live={variante === 'status' ? 'polite' : 'assertive'}
      tabIndex={-1}
      className={`aviso aviso--${variante}`}
    >
      {children}
    </div>
  );
});
