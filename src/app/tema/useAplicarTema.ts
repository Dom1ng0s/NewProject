import { useEffect } from 'react';
import { useConfiguracoes } from '@/modulos/nucleo';
import { resolverTema } from './tema';

function metasThemeColor(): readonly HTMLMetaElement[] {
  return Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
}

function aplicarTema(tema: 'sistema' | 'claro' | 'escuro', sistemaEscuro: boolean): void {
  const resolvido = resolverTema(tema, sistemaEscuro);
  document.documentElement.dataset['tema'] = resolvido;

  const corDeFundo = getComputedStyle(document.documentElement)
    .getPropertyValue('--cor-fundo')
    .trim();
  if (corDeFundo === '') return;
  for (const meta of metasThemeColor()) {
    meta.setAttribute('content', corDeFundo);
  }
}

/**
 * Aplica o tema escolhido nas configurações ao `<html data-tema>` (ADR 0008,
 * seção 6). Chamado uma vez em `App.tsx`, acima das rotas — vale para todas
 * as telas. Com `tema === 'sistema'`, acompanha `change` de
 * `matchMedia('(prefers-color-scheme: dark)')` sem precisar recarregar.
 */
export function useAplicarTema(): void {
  const { tema } = useConfiguracoes();

  useEffect(() => {
    const consultaDoSistema = matchMedia('(prefers-color-scheme: dark)');
    aplicarTema(tema, consultaDoSistema.matches);

    if (tema !== 'sistema') {
      return;
    }

    function aoMudarSistema(evento: MediaQueryListEvent): void {
      aplicarTema(tema, evento.matches);
    }

    consultaDoSistema.addEventListener('change', aoMudarSistema);
    return () => consultaDoSistema.removeEventListener('change', aoMudarSistema);
  }, [tema]);
}
