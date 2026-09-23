import { textos } from '@/i18n';
import { Aviso, Botao } from '@/ui';

/** Só apresentação: não conhece service worker (testável sem o módulo virtual). */
export interface AvisoDeAtualizacaoProps {
  readonly aoAtualizar: () => void;
  readonly aoDispensar: () => void;
  readonly atualizando: boolean;
}

/**
 * Aviso de versão nova do app (ADR 0007, seção 4). Não é modal: não move o
 * foco e não bloqueia nada, porque o usuário pode estar no meio de um
 * registro. Só existe no DOM quando há versão nova (ver `App.tsx`).
 */
export function AvisoDeAtualizacao({
  aoAtualizar,
  aoDispensar,
  atualizando,
}: AvisoDeAtualizacaoProps) {
  const t = textos.comum.atualizacao;
  return (
    <Aviso variante="status">
      <p>{t.mensagem}</p>
      <p>{t.dica}</p>
      <Botao variante="primario" onClick={aoAtualizar} aria-busy={atualizando}>
        {atualizando ? t.atualizando : t.atualizarAgora}
      </Botao>
      <Botao variante="secundario" onClick={aoDispensar}>
        {t.depois}
      </Botao>
    </Aviso>
  );
}
