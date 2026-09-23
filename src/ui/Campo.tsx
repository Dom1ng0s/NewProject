import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Rótulo visível, associado ao input via `<label for>` (nunca só `placeholder`). */
  readonly rotulo: string;
  readonly dica?: ReactNode;
  readonly id?: string;
}

/**
 * Rótulo + input + dica (ADR 0006, seção 7.8). Alvo de toque mínimo garantido
 * pelo token `--alvo-minimo` em `min-height`. Serve tanto para texto quanto
 * para `type="file"` (a tela Dados usa os dois).
 */
export function Campo({ rotulo, dica, id, className, ...props }: CampoProps) {
  const idGerado = useId();
  const idFinal = id ?? idGerado;
  const idDaDica = dica !== undefined ? `${idFinal}-dica` : undefined;

  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={idFinal}>
        {rotulo}
      </label>
      <input
        id={idFinal}
        className={['campo__entrada', className].filter(Boolean).join(' ')}
        aria-describedby={idDaDica}
        {...props}
      />
      {dica !== undefined ? (
        <p className="campo__dica" id={idDaDica}>
          {dica}
        </p>
      ) : null}
    </div>
  );
}
