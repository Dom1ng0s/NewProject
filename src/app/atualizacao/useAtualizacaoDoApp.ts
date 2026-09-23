import { useRegisterSW } from 'virtual:pwa-register/react';

/** Único ponto do app que conhece o service worker. Embrulha `useRegisterSW`. */
export interface AtualizacaoDoApp {
  readonly haVersaoNova: boolean;
  /** Ativa a versão nova e recarrega a página (`updateServiceWorker(true)`). */
  readonly atualizar: () => Promise<void>;
  /** Esconde o aviso até a próxima abertura do app. Não descarta a versão nova. */
  readonly dispensar: () => void;
}

/**
 * Hook de atualização do PWA (ADR 0007, seção 4). Sem verificação periódica:
 * a verificação nativa do navegador a cada abertura do app basta. `offlineReady`
 * é ignorado de propósito (sem aviso de "pronto para uso offline").
 */
export function useAtualizacaoDoApp(): AtualizacaoDoApp {
  const {
    needRefresh: [haVersaoNova, setHaVersaoNova],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (erro) => console.warn('Falha ao registrar o service worker.', erro),
  });

  return {
    haVersaoNova,
    atualizar: () => updateServiceWorker(true),
    dispensar: () => setHaVersaoNova(false),
  };
}
