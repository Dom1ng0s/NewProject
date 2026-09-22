import { atualizarRegistro, criarRegistro, emTransacao, estaAtivo, tabela } from '@/persistencia';
import type { RegistroBase } from '@/persistencia';
import {
  CONFIGURACOES_PADRAO,
  aplicarMudancas,
  validarConfiguracoes,
} from '../dominio/configuracoes';
import type { Configuracoes, MudancasDeConfiguracoes } from '../dominio/configuracoes';
import { registrarAcao } from './historico';

type RegistroDeConfiguracoes = Configuracoes & RegistroBase;

/**
 * Linha única com chave sentinela fixa — não UUID v7 (ADR 0005, seção 3.1).
 * É a única exceção deliberada à convenção de id do projeto: com id gerado,
 * duas abas (ou uma importação de backup) criariam duas linhas de
 * configuração. Com chave fixa, `put` é idempotente por construção.
 */
export const ID_DAS_CONFIGURACOES = 'configuracoes-unicas';

function tabelaDeConfiguracoes() {
  return tabela<RegistroDeConfiguracoes>('configuracoes');
}

function paraConfiguracoes(registro: RegistroDeConfiguracoes): Configuracoes {
  return {
    metaSemanalDeFocoEmMinutos: registro.metaSemanalDeFocoEmMinutos,
    metaSemanalDeTreinos: registro.metaSemanalDeTreinos,
    orcamentoMensalEmCentavos: registro.orcamentoMensalEmCentavos,
    unidadeDePeso: registro.unidadeDePeso,
    tema: registro.tema,
    onboardingConcluidoEm: registro.onboardingConcluidoEm,
  };
}

/**
 * Aplica a exceção de id sentinela sobre o registro recém-criado por
 * `criarRegistro` (que sempre geraria um UUID v7).
 */
function criarRegistroDeConfiguracoes(dados: Configuracoes): RegistroDeConfiguracoes {
  return { ...criarRegistro<RegistroDeConfiguracoes>(dados), id: ID_DAS_CONFIGURACOES };
}

/**
 * Nunca grava. Sem linha no banco, devolve uma CÓPIA de `CONFIGURACOES_PADRAO`
 * — nunca a própria referência congelada, para que um chamador que mutar o
 * objeto recebido não corrompa o padrão do app inteiro pelo resto da sessão
 * (afeta também `useConfiguracoes()`, que usa este mesmo caminho).
 */
export async function obterConfiguracoes(): Promise<Configuracoes> {
  const registro = await tabelaDeConfiguracoes().get(ID_DAS_CONFIGURACOES);
  if (!registro || !estaAtivo(registro)) return { ...CONFIGURACOES_PADRAO };
  return paraConfiguracoes(registro);
}

/**
 * Grava a mescla de `mudancas` sobre o que existe (ou sobre o padrão, na
 * primeira vez) e registra `'nucleo.configuracoesSalvas'` na MESMA
 * transação. Lança se `validarConfiguracoes` reprovar; nesse caso nada é
 * gravado. Devolve as configurações já gravadas.
 */
export async function salvarConfiguracoes(
  mudancas: MudancasDeConfiguracoes,
): Promise<Configuracoes> {
  return emTransacao(['configuracoes', 'historicoDeAcoes'], async () => {
    const registroAtual = await tabelaDeConfiguracoes().get(ID_DAS_CONFIGURACOES);
    // Parte do padrão (via `obterConfiguracoes`) tanto na ausência de linha
    // quanto numa linha inativa (`deletedAt` preenchido) — mesmo critério de
    // "existe" usado na leitura. "Configurações" não tem soft delete real
    // (ADR 0005): qualquer linha antiga com `deletedAt` preenchido é limpa
    // abaixo ao gravar, nunca mantida.
    const atuais = await obterConfiguracoes();
    const novas = aplicarMudancas(atuais, mudancas);

    const problemas = validarConfiguracoes(novas);
    if (problemas.length > 0) {
      throw new Error(`Configuracoes invalidas: ${problemas.join('; ')}`);
    }

    const registro = registroAtual
      ? { ...atualizarRegistro(registroAtual, novas), deletedAt: null }
      : criarRegistroDeConfiguracoes(novas);

    await tabelaDeConfiguracoes().put(registro);
    await registrarAcao({
      tipo: 'nucleo.configuracoesSalvas',
      modulo: 'nucleo',
      referenciaId: null,
      quantidade: null,
    });

    return paraConfiguracoes(registro);
  });
}
