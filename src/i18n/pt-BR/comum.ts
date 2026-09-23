const nomeDoApp = '[NOME DO APP]';

export const comum = {
  nomeDoApp,
  descricaoDoApp: 'Estudos, finanças e treino organizados no seu dispositivo, mesmo sem internet.',
  /** Textos da `<nav>` da moldura (ADR 0009, seção 1). */
  navegacao: {
    rotulo: 'Principal',
    hoje: 'Hoje',
    configuracoes: 'Configurações',
  },
  /** `Configurações · [NOME DO APP]`. A Hoje usa só `NOME_DO_APP`. */
  tituloDaPagina: (tela: string) => `${tela} · ${nomeDoApp}`,
  atualizacao: {
    mensagem: 'Há uma versão nova do app.',
    dica: 'Atualize quando terminar o que está fazendo. Seus dados não são afetados.',
    atualizarAgora: 'Atualizar agora',
    atualizando: 'Atualizando...',
    depois: 'Depois',
  },
} as const;
