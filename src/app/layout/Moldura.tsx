import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { textos } from '@/i18n';
import { AvisoDeAtualizacao } from '../atualizacao/AvisoDeAtualizacao';
import { useAtualizacaoDoApp } from '../atualizacao/useAtualizacaoDoApp';
import estilos from './Moldura.module.css';

const textosDeNavegacao = textos.comum.navegacao;

function classeDoLink({ isActive }: { readonly isActive: boolean }): string {
  return isActive ? `${estilos['link']} ${estilos['linkAtivo']}` : (estilos['link'] ?? '');
}

/**
 * Moldura comum a todas as telas (ADR 0009, seção 1): cabeçalho com a
 * navegação mínima (Hoje/Configurações) e o aviso de versão nova; o
 * conteúdo de cada rota entra pelo `<Outlet />`, com o seu próprio `<main>`
 * e `<h1>`. Cuida também do foco e da rolagem ao trocar de tela (seção 1).
 */
export function Moldura() {
  const { haVersaoNova, atualizar, dispensar } = useAtualizacaoDoApp();
  const [atualizando, setAtualizando] = useState(false);
  const { pathname } = useLocation();
  const pathnameAnteriorRef = useRef<string | null>(null);

  useEffect(() => {
    const pathnameAnterior = pathnameAnteriorRef.current;
    pathnameAnteriorRef.current = pathname;
    // Só move o foco quando a rota de fato mudou: nunca no primeiro
    // carregamento, e à prova do efeito duplo do StrictMode (o segundo
    // disparo vê `pathnameAnterior === pathname` e não faz nada).
    if (pathnameAnterior === null || pathnameAnterior === pathname) return;

    // Se a tela nova já moveu o foco de propósito no próprio efeito de
    // montagem (ex.: o campo de valor do "gasto em 3 toques", item 1.1) —
    // efeitos de componente filho rodam antes dos do pai, então isso já
    // aconteceu quando este efeito roda — não sobrescreve. Sem foco nenhum
    // ainda, o elemento ativo continua `<body>` (o antigo elemento focado
    // saiu do documento com a troca de rota), e o `<h1>` assume como sempre.
    if (document.activeElement && document.activeElement !== document.body) return;

    const tituloDaTela = document.querySelector<HTMLElement>('main h1');
    if (!tituloDaTela) return;
    tituloDaTela.tabIndex = -1;
    tituloDaTela.focus();
  }, [pathname]);

  function aoAtualizar() {
    setAtualizando(true);
    void atualizar();
  }

  return (
    <>
      <header className={estilos['cabecalho']}>
        <nav aria-label={textosDeNavegacao.rotulo}>
          <ul className={estilos['listaDeNavegacao']}>
            <li>
              <NavLink to="/" end className={classeDoLink} tabIndex={0}>
                {textosDeNavegacao.hoje}
              </NavLink>
            </li>
            <li>
              <NavLink to="/configuracoes" className={classeDoLink} tabIndex={0}>
                {textosDeNavegacao.configuracoes}
              </NavLink>
            </li>
          </ul>
        </nav>
        {haVersaoNova && (
          <AvisoDeAtualizacao
            aoAtualizar={aoAtualizar}
            aoDispensar={dispensar}
            atualizando={atualizando}
          />
        )}
      </header>
      <Outlet />
    </>
  );
}
