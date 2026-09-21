/**
 * Gera identificadores UUID v7 (RFC 9562): 48 bits de timestamp em milissegundos
 * seguidos de bits aleatórios, o que faz o identificador ordenar
 * cronologicamente quando comparado como string.
 *
 * Usa um contador monotônico para os bits que seguem o timestamp: se duas
 * chamadas caem no mesmo milissegundo (ou o relógio andar para trás), o
 * contador é incrementado em vez de sortear de novo, garantindo ordem
 * estritamente crescente mesmo em geração rápida em sequência.
 */

const BITS_DO_CONTADOR = 0x0fff; // 12 bits

let ultimoTimestampMs = -1;
let contador = 0;

function gerarContadorAleatorio(): number {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(2));
  const alto = bytes[0] ?? 0;
  const baixo = bytes[1] ?? 0;
  return ((alto << 8) | baixo) & BITS_DO_CONTADOR;
}

function proximoTimestampEContador(): { timestamp: number; contador: number } {
  const agora = Date.now();

  if (agora > ultimoTimestampMs) {
    ultimoTimestampMs = agora;
    contador = gerarContadorAleatorio();
  } else {
    contador = (contador + 1) & BITS_DO_CONTADOR;
  }

  return { timestamp: ultimoTimestampMs, contador };
}

function paraHexComZeros(valor: number, digitos: number): string {
  return valor.toString(16).padStart(digitos, '0');
}

/** Gera um novo UUID v7, único e ordenável como string. */
export function gerarIdentificador(): string {
  const { timestamp, contador: bitsDoContador } = proximoTimestampEContador();

  const timestampHex = paraHexComZeros(timestamp, 12); // 48 bits = 12 hex

  const versaoEContador = 0x7000 | bitsDoContador; // versão 7 no nibble alto
  const versaoEContadorHex = paraHexComZeros(versaoEContador, 4);

  const randomB = globalThis.crypto.getRandomValues(new Uint8Array(8));
  const primeiroByte = randomB[0] ?? 0;
  const variantERandomHex = paraHexComZeros(0x80 | (primeiroByte & 0x3f), 2); // variante 10

  const restanteHex = Array.from(randomB.slice(1), (b) => paraHexComZeros(b, 2)).join('');

  return [
    timestampHex.slice(0, 8),
    timestampHex.slice(8, 12),
    versaoEContadorHex,
    `${variantERandomHex}${restanteHex.slice(0, 2)}`,
    restanteHex.slice(2),
  ].join('-');
}
