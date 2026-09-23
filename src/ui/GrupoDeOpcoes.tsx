import { useId } from 'react';

export interface OpcaoDoGrupo<V extends string> {
  readonly valor: V;
  readonly rotulo: string;
}

export interface GrupoDeOpcoesProps<V extends string> {
  readonly legenda: string;
  readonly opcoes: readonly OpcaoDoGrupo<V>[];
  readonly valor: V;
  readonly aoMudar: (valor: V) => void;
  readonly dica?: string;
}

/**
 * Rádios nativos em `<fieldset>`/`<legend>` (ADR 0008, seção 8.1). Um
 * `<label>` por opção envolve o `<input type="radio">` (mesmo `name`, via
 * `useId`); o `<label>` inteiro é o alvo de toque (`min-height:
 * var(--alvo-minimo)`, `.grupo-de-opcoes__opcao`). Sem desenho próprio do
 * rádio: foco, setas do teclado e leitor de tela vêm do navegador.
 */
export function GrupoDeOpcoes<V extends string>({
  legenda,
  opcoes,
  valor,
  aoMudar,
  dica,
}: GrupoDeOpcoesProps<V>) {
  const idBase = useId();
  const nome = `${idBase}-grupo`;
  const idDaDica = dica !== undefined ? `${idBase}-dica` : undefined;

  return (
    <fieldset className="grupo-de-opcoes" aria-describedby={idDaDica}>
      <legend className="grupo-de-opcoes__legenda">{legenda}</legend>
      {dica !== undefined ? (
        <p className="grupo-de-opcoes__dica" id={idDaDica}>
          {dica}
        </p>
      ) : null}
      {opcoes.map((opcao) => (
        <label key={opcao.valor} className="grupo-de-opcoes__opcao">
          <input
            type="radio"
            name={nome}
            value={opcao.valor}
            checked={opcao.valor === valor}
            onChange={() => aoMudar(opcao.valor)}
          />
          {opcao.rotulo}
        </label>
      ))}
    </fieldset>
  );
}
