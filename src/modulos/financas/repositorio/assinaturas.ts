import { registrarAcao } from '@/modulos/nucleo';
import {
  apenasAtivos,
  atualizarRegistro,
  criarRegistro,
  emTransacao,
  estaAtivo,
  marcarComoExcluido,
  tabela,
} from '@/persistencia';
import type { RegistroBase } from '@/persistencia';
import {
  calcularCobrancasVencidas,
  diaDoMesDe,
  problemasDeAssinatura,
} from '../dominio/assinaturas';
import type {
  AssinaturaParaCobranca,
  DadosDeAssinatura,
  DadosDeUsoDeAssinatura,
  Periodicidade,
} from '../dominio/assinaturas';
import type { DadosDeLancamento } from '../dominio/lancamentos';
import { instanteAoMeioDiaLocal } from './lancamentos';

type RegistroDeAssinatura = DadosDeAssinatura & RegistroBase;
type RegistroDeUso = DadosDeUsoDeAssinatura & RegistroBase;
type RegistroDeLancamento = DadosDeLancamento & RegistroBase;

export interface Assinatura extends DadosDeAssinatura {
  readonly id: string;
}

export interface UsoDeAssinatura extends DadosDeUsoDeAssinatura {
  readonly id: string;
}

/** Campos que a tela de cadastro/edição preenche; `diaDeCobranca` é sempre derivado de `proximaCobranca` (comentário de `DadosDeAssinatura`). */
export interface DadosDeFormularioDeAssinatura {
  readonly nome: string;
  readonly valorCentavos: number;
  readonly periodicidade: Periodicidade;
  readonly proximaCobranca: string;
  readonly diasDeAviso: number;
  readonly categoriaId: string;
}

function tabelaDeAssinaturas() {
  return tabela<RegistroDeAssinatura>('assinaturas');
}
function tabelaDeUsos() {
  return tabela<RegistroDeUso>('usosDeAssinatura');
}
function tabelaDeLancamentos() {
  return tabela<RegistroDeLancamento>('lancamentos');
}

function paraAssinatura(registro: RegistroDeAssinatura): Assinatura {
  return {
    id: registro.id,
    nome: registro.nome,
    valorCentavos: registro.valorCentavos,
    periodicidade: registro.periodicidade,
    proximaCobranca: registro.proximaCobranca,
    diasDeAviso: registro.diasDeAviso,
    categoriaId: registro.categoriaId,
    diaDeCobranca: registro.diaDeCobranca,
  };
}

function paraUso(registro: RegistroDeUso): UsoDeAssinatura {
  return { id: registro.id, assinaturaId: registro.assinaturaId, data: registro.data };
}

function compararAssinaturas(a: Assinatura, b: Assinatura): number {
  if (a.proximaCobranca !== b.proximaCobranca) {
    return a.proximaCobranca < b.proximaCobranca ? -1 : 1;
  }
  return a.nome.localeCompare(b.nome, 'pt-BR');
}

/** Só ativas, ordenadas pela próxima cobrança mais próxima primeiro. */
export async function listarAssinaturas(): Promise<Assinatura[]> {
  const registros = await tabelaDeAssinaturas().toArray();
  return apenasAtivos(registros).map(paraAssinatura).sort(compararAssinaturas);
}

/** `null` quando a assinatura não existe ou já foi excluída. */
export async function obterAssinatura(id: string): Promise<Assinatura | null> {
  const registro = await tabelaDeAssinaturas().get(id);
  if (!registro || !estaAtivo(registro)) return null;
  return paraAssinatura(registro);
}

/** Lança se `problemasDeAssinatura` reprovar; nesse caso nada é gravado. `diaDeCobranca` é sempre derivado do dia de `proximaCobranca`. */
export async function criarAssinatura(dados: DadosDeFormularioDeAssinatura): Promise<Assinatura> {
  const candidato: DadosDeAssinatura = { ...dados, diaDeCobranca: diaDoMesDe(dados.proximaCobranca) };
  const problemas = problemasDeAssinatura(candidato);
  if (problemas.length > 0) throw new Error(problemas.join('; '));

  const registro = criarRegistro<RegistroDeAssinatura>(candidato);
  await tabelaDeAssinaturas().put(registro);
  return paraAssinatura(registro);
}

/**
 * Lança se a mescla resultante for inválida; nesse caso nada é gravado. Não
 * faz nada se a assinatura não existir ou já estiver excluída. Mudar
 * `proximaCobranca` aqui (o usuário corrigindo a data à mão) recalcula
 * `diaDeCobranca` a partir da nova data — só a cobrança automática avança a
 * data SEM tocar na âncora.
 */
export async function editarAssinatura(
  id: string,
  mudancas: Partial<DadosDeFormularioDeAssinatura>,
): Promise<void> {
  const registro = await tabelaDeAssinaturas().get(id);
  if (!registro || !estaAtivo(registro)) return;

  const atual = paraAssinatura(registro);
  const diaDeCobranca =
    mudancas.proximaCobranca !== undefined
      ? diaDoMesDe(mudancas.proximaCobranca)
      : atual.diaDeCobranca;
  const candidato: DadosDeAssinatura = { ...atual, ...mudancas, diaDeCobranca };

  const problemas = problemasDeAssinatura(candidato);
  if (problemas.length > 0) throw new Error(problemas.join('; '));

  await tabelaDeAssinaturas().put(atualizarRegistro(registro, candidato));
}

/** Soft delete. Não faz nada se a assinatura não existir ou já estiver excluída. */
export async function excluirAssinatura(id: string): Promise<void> {
  const registro = await tabelaDeAssinaturas().get(id);
  if (!registro || !estaAtivo(registro)) return;
  await tabelaDeAssinaturas().put(marcarComoExcluido(registro));
}

/**
 * "Usei hoje" (item 1.3): um uso por dia por assinatura — tocar de novo no
 * mesmo dia não duplica. `hoje` é parâmetro para os testes controlarem o
 * relógio.
 */
export async function registrarUsoHoje(assinaturaId: string, hoje: string): Promise<void> {
  const usos = await tabelaDeUsos().where('assinaturaId').equals(assinaturaId).toArray();
  const jaUsouHoje = apenasAtivos(usos).some((uso) => uso.data === hoje);
  if (jaUsouHoje) return;

  const registro = criarRegistro<RegistroDeUso>({ assinaturaId, data: hoje });
  await tabelaDeUsos().put(registro);
}

/** Todos os usos ativos de uma assinatura, mais recente primeiro. */
export async function listarUsosDaAssinatura(assinaturaId: string): Promise<UsoDeAssinatura[]> {
  const registros = await tabelaDeUsos().where('assinaturaId').equals(assinaturaId).toArray();
  return apenasAtivos(registros)
    .map(paraUso)
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}

/** Quantidade de usos ativos no mês (`anoMes` = `AAAA-MM`) — base do custo por uso (item 1.3). */
export async function contarUsosNoMes(assinaturaId: string, anoMes: string): Promise<number> {
  const usos = await listarUsosDaAssinatura(assinaturaId);
  return usos.filter((uso) => uso.data.startsWith(anoMes)).length;
}

/**
 * Cobrança automática (item 1.3, ESPECIFICACAO §6.2, critério de aceite):
 * para cada assinatura ativa, gera o(s) lançamento(s) de gasto de toda
 * cobrança vencida (`calcularCobrancasVencidas`, regra pura) e avança
 * `proximaCobranca`. Idempotente: antes de criar um lançamento, verifica se
 * já existe um com o mesmo `assinaturaId` + `data` (não duplica ao rodar duas
 * vezes — ex.: abrir o app e o evento `visibilitychange` na mesma sessão).
 * `hoje` é parâmetro para os testes e para quem chama controlar o relógio.
 */
export async function processarCobrancasAutomaticas(hoje: string): Promise<void> {
  const registros = apenasAtivos(await tabelaDeAssinaturas().toArray());
  if (registros.length === 0) return;

  await emTransacao(['assinaturas', 'lancamentos', 'historicoDeAcoes'], async () => {
    for (const registro of registros) {
      const assinatura = paraAssinatura(registro);
      const paraCalculo: AssinaturaParaCobranca = {
        valorCentavos: assinatura.valorCentavos,
        periodicidade: assinatura.periodicidade,
        proximaCobranca: assinatura.proximaCobranca,
        diaDeCobranca: assinatura.diaDeCobranca,
      };
      const { cobrancasVencidas, novaProximaCobranca } = calcularCobrancasVencidas(
        paraCalculo,
        hoje,
      );
      if (cobrancasVencidas.length === 0) continue;

      const lancamentosDaAssinatura = apenasAtivos(
        await tabelaDeLancamentos().where('assinaturaId').equals(assinatura.id).toArray(),
      );
      const datasJaLancadas = new Set(lancamentosDaAssinatura.map((lancamento) => lancamento.data));

      for (const cobranca of cobrancasVencidas) {
        if (datasJaLancadas.has(cobranca.data)) continue; // idempotente: nao duplica se ja rodou

        const dadosDoLancamento: DadosDeLancamento = {
          tipo: 'gasto',
          valorCentavos: assinatura.valorCentavos,
          categoriaId: assinatura.categoriaId,
          descricao: assinatura.nome,
          data: cobranca.data,
          assinaturaId: assinatura.id,
        };
        const lancamento = criarRegistro<RegistroDeLancamento>(dadosDoLancamento);
        await tabelaDeLancamentos().put(lancamento);
        await registrarAcao({
          tipo: 'financas.lancamentoRegistrado',
          modulo: 'financas',
          referenciaId: lancamento.id,
          quantidade: assinatura.valorCentavos,
          ocorridaEm: instanteAoMeioDiaLocal(cobranca.data),
        });
      }

      if (novaProximaCobranca !== assinatura.proximaCobranca) {
        await tabelaDeAssinaturas().put(
          atualizarRegistro(registro, { proximaCobranca: novaProximaCobranca }),
        );
      }
    }
  });
}
