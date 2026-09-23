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

/** Campos numéricos de `Configuracoes` (ADR 0008, seção 4). */
export type CampoNumericoDeConfiguracoes =
  'metaSemanalDeFocoEmMinutos' | 'metaSemanalDeTreinos' | 'orcamentoMensalEmCentavos';

/** Um problema de validação estruturado (ADR 0008, seção 4). */
export interface ProblemaDeConfiguracoes {
  readonly campo: CampoNumericoDeConfiguracoes;
  readonly codigo: 'naoEhInteiro' | 'negativo';
  /** Texto de desenvolvedor, igual ao que `validarConfiguracoes` já devolve hoje. */
  readonly mensagem: string;
}

function problemaDoCampoNumerico(
  campo: CampoNumericoDeConfiguracoes,
  valor: number,
  mensagem: string,
): ProblemaDeConfiguracoes | null {
  if (!Number.isInteger(valor)) {
    return { campo, codigo: 'naoEhInteiro', mensagem };
  }
  if (valor < 0) {
    return { campo, codigo: 'negativo', mensagem };
  }
  return null;
}

/**
 * Fonte única das regras de validação de `Configuracoes` (ADR 0008, seção 4).
 * Lista vazia = válido. `unidadeDePeso` e `tema` não entram: são uniões de
 * literais, já garantidas pelo tipo.
 */
export function problemasDeConfiguracoes(
  configuracoes: Configuracoes,
): readonly ProblemaDeConfiguracoes[] {
  const problemas: ProblemaDeConfiguracoes[] = [];

  const problemaDeFoco = problemaDoCampoNumerico(
    'metaSemanalDeFocoEmMinutos',
    configuracoes.metaSemanalDeFocoEmMinutos,
    'metaSemanalDeFocoEmMinutos deve ser um inteiro maior ou igual a zero.',
  );
  if (problemaDeFoco !== null) {
    problemas.push(problemaDeFoco);
  }

  const problemaDeTreinos = problemaDoCampoNumerico(
    'metaSemanalDeTreinos',
    configuracoes.metaSemanalDeTreinos,
    'metaSemanalDeTreinos deve ser um inteiro maior ou igual a zero.',
  );
  if (problemaDeTreinos !== null) {
    problemas.push(problemaDeTreinos);
  }

  const orcamento = configuracoes.orcamentoMensalEmCentavos;
  if (orcamento !== null) {
    const problemaDeOrcamento = problemaDoCampoNumerico(
      'orcamentoMensalEmCentavos',
      orcamento,
      'orcamentoMensalEmCentavos deve ser null ou um inteiro maior ou igual a zero.',
    );
    if (problemaDeOrcamento !== null) {
      problemas.push(problemaDeOrcamento);
    }
  }

  return problemas;
}

/** Devolve a lista de problemas; vazia = válido. Mensagens são de desenvolvedor. */
export function validarConfiguracoes(configuracoes: Configuracoes): string[] {
  return problemasDeConfiguracoes(configuracoes).map((problema) => problema.mensagem);
}

/** Mescla pura, sem relógio e sem banco. */
export function aplicarMudancas(
  atuais: Configuracoes,
  mudancas: MudancasDeConfiguracoes,
): Configuracoes {
  return { ...atuais, ...mudancas };
}
