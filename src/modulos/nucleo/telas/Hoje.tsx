import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type { AtalhoDeRegistro, CartaoDeHoje } from '../tipos';
import { textos } from '@/i18n';
import { useTituloDaPagina } from '@/ui';
import estilos from './Hoje.module.css';

const textosDaHoje = textos.nucleo.hoje;

export interface TelaHojeProps {
  readonly cartoes: readonly CartaoDeHoje[];
  readonly atalhos: readonly AtalhoDeRegistro[];
}

/**
 * Tela `/` (ADR 0009, seção 2). Sem estado, sem efeito, sem leitura de
 * banco: só desenha o que recebe por prop. Registro rápido primeiro (é o
 * que mais se usa), cartões dos pilares depois, ambos ordenados por `ordem`
 * sem mutar as props recebidas.
 */
export function TelaHoje({ cartoes, atalhos }: TelaHojeProps): ReactElement {
  useTituloDaPagina(textos.comum.nomeDoApp);
  const cartoesOrdenados = [...cartoes].sort((a, b) => a.ordem - b.ordem);
  const atalhosOrdenados = [...atalhos].sort((a, b) => a.ordem - b.ordem);

  return (
    <main className={estilos['pagina']}>
      <h1>{textosDaHoje.titulo}</h1>

      <section className={estilos['registro']}>
        <h2>{textosDaHoje.registroRapido.titulo}</h2>
        {atalhosOrdenados.length > 0 ? (
          <ul className={estilos['listaDeAtalhos']}>
            {atalhosOrdenados.map((atalho) => (
              <li key={atalho.modulo}>
                <Link to={atalho.destino} className="botao botao--primario">
                  {atalho.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={estilos['textoVazio']}>{textosDaHoje.registroRapido.vazio}</p>
        )}
      </section>

      <div className={estilos['cartoes']}>
        {cartoesOrdenados.map((cartao) => {
          const Componente = cartao.Componente;
          return (
            <section key={cartao.modulo} className={estilos['cartao']}>
              <h2>{cartao.titulo}</h2>
              <Componente />
            </section>
          );
        })}
      </div>
    </main>
  );
}
