/**
 * Regras puras de configurações (D4): metas semanais, orçamento e unidades
 * vêm sempre daqui — nenhuma regra do app usa valor fixo no código. Sem
 * React, sem banco, sem relógio.
 */
export interface Configuracoes {
  metaSemanalDeFocoEmMinutos: number;
  metaSemanalDeTreinos: number;
  orcamentoMensalEmCentavos: number | null;
  unidadeDePeso: 'kg' | 'lb';
  tema: 'sistema' | 'claro' | 'escuro';
  onboardingConcluidoEm: string | null;
}

export type MudancasDeConfiguracoes = Partial<Configuracoes>;

/**
 * Única constante de negócio fixa no código (ADR 0005, decisão do usuário em
 * 2026-09-21): é o padrão da configuração antes do onboarding (item 5.3),
 * não um valor usado por regra. D4 continua valendo sem exceção — toda
 * regra lê `Configuracoes`, nunca esta constante.
 *
 * Metas com padrão neutro e utilizável; orçamento `null` porque não existe
 * orçamento neutro (inventar um valor faria a Hoje calcular "disponível
 * para hoje" com algo que o usuário nunca autorizou).
 */
export const CONFIGURACOES_PADRAO: Configuracoes = Object.freeze({
  metaSemanalDeFocoEmMinutos: 600, // 10 h por semana
  metaSemanalDeTreinos: 3,
  orcamentoMensalEmCentavos: null, // sem orçamento até o usuário definir
  unidadeDePeso: 'kg',
  tema: 'sistema',
  onboardingConcluidoEm: null,
});

/** Devolve a lista de problemas; vazia = válido. Mensagens são de desenvolvedor. */
export function validarConfiguracoes(configuracoes: Configuracoes): string[] {
  const problemas: string[] = [];

  if (
    !Number.isInteger(configuracoes.metaSemanalDeFocoEmMinutos) ||
    configuracoes.metaSemanalDeFocoEmMinutos < 0
  ) {
    problemas.push('metaSemanalDeFocoEmMinutos deve ser um inteiro maior ou igual a zero.');
  }

  if (
    !Number.isInteger(configuracoes.metaSemanalDeTreinos) ||
    configuracoes.metaSemanalDeTreinos < 0
  ) {
    problemas.push('metaSemanalDeTreinos deve ser um inteiro maior ou igual a zero.');
  }

  const orcamento = configuracoes.orcamentoMensalEmCentavos;
  if (orcamento !== null && (!Number.isInteger(orcamento) || orcamento < 0)) {
    problemas.push('orcamentoMensalEmCentavos deve ser null ou um inteiro maior ou igual a zero.');
  }

  return problemas;
}

/** Mescla pura, sem relógio e sem banco. */
export function aplicarMudancas(
  atuais: Configuracoes,
  mudancas: MudancasDeConfiguracoes,
): Configuracoes {
  return { ...atuais, ...mudancas };
}
