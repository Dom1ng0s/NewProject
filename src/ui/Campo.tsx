import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Rótulo visível, associado ao input via `<label for>` (nunca só `placeholder`). */
  readonly rotulo: string;
  readonly dica?: ReactNode;
  readonly id?: string;
  /**
   * Mensagem de erro (ADR 0008, seção 4/8.1). Sem esta prop, o `Campo`
   * renderiza exatamente como antes (sem `aria-invalid`, sem `role="alert"`).
   * Com a prop presente (mesmo `''`), um elemento `role="alert"` é montado
   * (vazio quando não há erro) e ligado por `aria-describedby`; `aria-invalid`
   * só aparece quando `erro !== ''`.
   */
  readonly erro?: string;
}

/**
 * Rótulo + input + dica (ADR 0006, seção 7.8). Alvo de toque mínimo garantido
 * pelo token `--alvo-minimo` em `min-height`. Serve tanto para texto quanto
 * para `type="file"` (a tela Dados usa os dois). Encaminha `ref` (mesmo
 * padrão de `Botao`/`Aviso`) para os fluxos que precisam focar o `<input>`
 * por código — o atributo HTML `autoFocus` não é confiável em navegação de
 * SPA (o elemento nasce depois do carregamento inicial da página).
 */
export const Campo = forwardRef<HTMLInputElement, CampoProps>(function Campo(
  { rotulo, dica, id, erro, className, ...props },
  ref,
) {
  const idGerado = useId();
  const idFinal = id ?? idGerado;
  const idDaDica = dica !== undefined ? `${idFinal}-dica` : undefined;
  const temErro = erro !== undefined;
  const idDoErro = temErro ? `${idFinal}-erro` : undefined;
  const idsDaDescricao = [idDaDica, idDoErro].filter(Boolean).join(' ') || undefined;

  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={idFinal}>
        {rotulo}
      </label>
      <input
        ref={ref}
        id={idFinal}
        className={['campo__entrada', className].filter(Boolean).join(' ')}
        aria-describedby={idsDaDescricao}
        aria-invalid={temErro && erro !== '' ? 'true' : undefined}
        {...props}
      />
      {dica !== undefined ? (
        <p className="campo__dica" id={idDaDica}>
          {dica}
        </p>
      ) : null}
      {temErro ? (
        <p className="campo__erro" id={idDoErro} role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  );
});
