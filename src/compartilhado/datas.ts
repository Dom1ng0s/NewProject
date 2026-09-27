/**
 * Instantes e datas de calendário (ADR 0005, seção 2 e seção 3 do
 * `docs/ESPECIFICACAO.md`): instantes são sempre ISO 8601 em UTC, com `Z`;
 * datas de calendário (dia do gasto, dia do treino, dia da ação do
 * histórico) são `AAAA-MM-DD` no fuso local do dispositivo (ou do processo,
 * em teste/build), sem hora.
 *
 * Nunca derive uma data de calendário de `instante.toISOString().slice(0, 10)`:
 * isso usa o fuso UTC e erra o dia entre as 21h e a meia-noite em
 * `America/Sao_Paulo`. Use sempre `dataDeCalendarioDe`.
 */

/** Regex mínimo de "parece um instante": data e hora separadas por `T`. Não
 * valida o formato inteiro (isso fica por conta do `Date` e do `NaN` check
 * abaixo) — só garante que existe componente de hora, para pegar o caso de
 * `'2026-09-21'` (só data de calendário) antes que ele vire meia-noite UTC
 * silenciosa. */
const PARECE_INSTANTE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Instante inválido (string vazia, texto qualquer, `NaN`, ou já uma data de
 * calendário como `'2026-09-21'` em vez de um instante) nunca deve virar
 * `'NaN-NaN-NaN'` ou um dia errado silencioso gravado num campo indexado —
 * lança cedo em ambos os casos. */
function validarInstante(instanteIso: string, instante: Date): void {
  if (Number.isNaN(instante.getTime())) {
    throw new Error(`dataDeCalendarioDe: instante ISO inválido: ${JSON.stringify(instanteIso)}`);
  }
  if (!PARECE_INSTANTE_ISO.test(instanteIso)) {
    throw new Error(
      `dataDeCalendarioDe: ${JSON.stringify(instanteIso)} parece uma data de calendário, não um instante`,
    );
  }
}

function comDoisDigitos(valor: number): string {
  return valor.toString().padStart(2, '0');
}

/** Instante atual em ISO 8601, UTC, com milissegundos e sufixo `Z`. */
export function agoraEmIso(): string {
  return new Date().toISOString();
}

/**
 * `AAAA-MM-DD` no fuso local a partir de um instante ISO. Usa os getters
 * locais de `Date` (não os `UTC*`), que respeitam o fuso horário do
 * dispositivo (navegador) ou do processo (`TZ`, em Node/testes/build).
 */
export function dataDeCalendarioDe(instanteIso: string): string {
  const instante = new Date(instanteIso);
  validarInstante(instanteIso, instante);
  const ano = instante.getFullYear();
  const mes = comDoisDigitos(instante.getMonth() + 1);
  const dia = comDoisDigitos(instante.getDate());
  return `${ano}-${mes}-${dia}`;
}

/** `dataDeCalendarioDe(agoraEmIso())`: hoje, no fuso local. */
export function hojeEmDataDeCalendario(): string {
  return dataDeCalendarioDe(agoraEmIso());
}

const PADRAO_DE_DATA_DE_CALENDARIO = /^(\d{4})-(\d{2})-(\d{2})$/;

function partesDeDataDeCalendario(data: string): { ano: number; mes: number; dia: number } {
  const [anoTexto, mesTexto, diaTexto] = data.split('-');
  return { ano: Number(anoTexto), mes: Number(mesTexto), dia: Number(diaTexto) };
}

/** Último dia do mês (1-31); `mesIndiceZero` vai de 0 (janeiro) a 11 (dezembro). */
export function ultimoDiaDoMes(ano: number, mesIndiceZero: number): number {
  return new Date(ano, mesIndiceZero + 1, 0).getDate();
}

/**
 * `data` (`AAAA-MM-DD`) + `meses` (pode ser negativo), usando `diaAncora`
 * (1-31) como o dia desejado no mês de destino — cai no último dia do mês
 * quando ele é mais curto que o dia âncora (ex.: 31/01 + 1 mês, âncora 31 →
 * 28/02 ou 29/02), sem perder o dia âncora na chamada seguinte: quem chama de
 * novo com o mesmo `diaAncora` (nunca com o dia já clampado) volta para 31 em
 * março. Usada pela cobrança automática de assinaturas (item 1.3 do plano).
 */
export function adicionarMeses(data: string, meses: number, diaAncora: number): string {
  const { ano, mes } = partesDeDataDeCalendario(data);
  const totalDeMeses = ano * 12 + (mes - 1) + meses;
  const novoAno = Math.floor(totalDeMeses / 12);
  const novoMesIndiceZero = ((totalDeMeses % 12) + 12) % 12;
  const dia = Math.min(diaAncora, ultimoDiaDoMes(novoAno, novoMesIndiceZero));
  return `${String(novoAno).padStart(4, '0')}-${comDoisDigitos(novoMesIndiceZero + 1)}-${comDoisDigitos(dia)}`;
}

/**
 * Diferença em dias de calendário, `ate − de` (pode ser negativo). Calculada
 * ao meio-dia local (evita erro de 1 dia por causa do horário de verão).
 */
export function diasEntreDatas(de: string, ate: string): number {
  const { ano: anoDe, mes: mesDe, dia: diaDe } = partesDeDataDeCalendario(de);
  const { ano: anoAte, mes: mesAte, dia: diaAte } = partesDeDataDeCalendario(ate);
  const inicioMs = new Date(anoDe, mesDe - 1, diaDe, 12, 0, 0, 0).getTime();
  const fimMs = new Date(anoAte, mesAte - 1, diaAte, 12, 0, 0, 0).getTime();
  return Math.round((fimMs - inicioMs) / 86_400_000);
}

/** `data` (`AAAA-MM-DD`) + `dias` (pode ser negativo). */
export function somarDias(data: string, dias: number): string {
  const { ano, mes, dia } = partesDeDataDeCalendario(data);
  const instante = new Date(ano, mes - 1, dia + dias, 12, 0, 0, 0);
  return `${String(instante.getFullYear()).padStart(4, '0')}-${comDoisDigitos(instante.getMonth() + 1)}-${comDoisDigitos(instante.getDate())}`;
}

/**
 * `true` só para uma `AAAA-MM-DD` que corresponde a um dia real do
 * calendário: rejeita mês/dia fora do intervalo (`2026-13-01`) e dia
 * inexistente no mês (`2026-02-30`), que um regex sozinho aceitaria. Usada
 * para validar data retroativa digitada pelo usuário (ex.: `<input
 * type="date">` de um gasto).
 */
export function ehDataDeCalendarioValida(texto: string): boolean {
  const combinacao = PADRAO_DE_DATA_DE_CALENDARIO.exec(texto);
  if (!combinacao) return false;

  const anoTexto = combinacao[1] ?? '';
  const mesTexto = combinacao[2] ?? '';
  const diaTexto = combinacao[3] ?? '';
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);

  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}
