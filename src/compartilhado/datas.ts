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
