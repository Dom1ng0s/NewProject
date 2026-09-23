// Gera os ícones provisórios do PWA (ADR 0007, seção 1). Roda à mão
// (`npm run icones`); os arquivos gerados ficam versionados em
// `public/icones/`. Não roda no build nem no CI.
//
// O glifo é sempre o mesmo: três barras brancas verticais crescentes, bases
// alinhadas, sobre fundo `#0a5cb8`. Só o enquadramento (lado do ícone, fundo
// opaco ou com cantos transparentes, e a "caixa do glifo") muda por variante.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PASTA_ICONES = join(__dirname, '..', 'public', 'icones');

const COR_PRIMARIA = '#0a5cb8';

// Geometria do glifo, em unidades de um quadrado de lado 100 (ADR 0007 §1):
// barras de largura 14, espaço 8 entre elas, cantos com raio 4, bases
// alinhadas, alturas 30/45/60. O conjunto ocupa 58 (largura) × 60 (altura).
const LARGURA_BARRA = 14;
const RAIO_BARRA = 4;
const LARGURA_GLIFO = 58;
const ALTURA_GLIFO = 60;
const BARRAS = [
  { x: 0, altura: 30 },
  { x: 22, altura: 45 },
  { x: 44, altura: 60 },
];

/**
 * Monta o SVG de uma variante: fundo `#0a5cb8` (com cantos arredondados e
 * transparentes, ou opaco cobrindo o quadrado inteiro) e o glifo escalado
 * para caber na "caixa do glifo" (percentual do lado) e centralizado.
 */
function montarSvg({ lado, opaco, caixaPercentual }) {
  const raioCantosFundo = opaco ? 0 : lado * 0.225;
  const caixaLado = lado * caixaPercentual;
  // A altura (60) é a dimensão que limita o encaixe: a escala é definida por
  // ela, e a largura (58) sobra dentro da caixa.
  const escala = caixaLado / ALTURA_GLIFO;
  const larguraGlifoEscalada = LARGURA_GLIFO * escala;
  const alturaGlifoEscalada = ALTURA_GLIFO * escala;
  const deslocamentoX = (lado - larguraGlifoEscalada) / 2;
  const deslocamentoY = (lado - alturaGlifoEscalada) / 2;
  const raioBarra = RAIO_BARRA * escala;

  const barras = BARRAS.map(({ x, altura }) => {
    const larguraPx = LARGURA_BARRA * escala;
    const alturaPx = altura * escala;
    const xPx = deslocamentoX + x * escala;
    const yPx = deslocamentoY + (ALTURA_GLIFO - altura) * escala;
    return `<rect x="${xPx}" y="${yPx}" width="${larguraPx}" height="${alturaPx}" rx="${raioBarra}" ry="${raioBarra}" fill="#ffffff" />`;
  }).join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${lado}" height="${lado}">
    <rect x="0" y="0" width="${lado}" height="${lado}" rx="${raioCantosFundo}" ry="${raioCantosFundo}" fill="${COR_PRIMARIA}" />
    ${barras}
  </svg>`;
}

const VARIANTES_PNG = [
  { arquivo: 'icone-192.png', lado: 192, opaco: false, caixaPercentual: 0.6 },
  { arquivo: 'icone-512.png', lado: 512, opaco: false, caixaPercentual: 0.6 },
  { arquivo: 'icone-maskable-512.png', lado: 512, opaco: true, caixaPercentual: 0.5 },
  { arquivo: 'apple-touch-icon-180.png', lado: 180, opaco: true, caixaPercentual: 0.5 },
];

async function gerarPngs() {
  const navegador = await chromium.launch();
  try {
    // `deviceScaleFactor: 1` garante que o PNG gerado tenha exatamente
    // `lado` × `lado` pixels, sem escala de tela.
    const pagina = await navegador.newPage({ deviceScaleFactor: 1 });
    for (const variante of VARIANTES_PNG) {
      await pagina.setViewportSize({ width: variante.lado, height: variante.lado });
      const svg = montarSvg(variante);
      await pagina.setContent(
        `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent;}</style></head><body>${svg}</body></html>`,
      );
      const caminho = join(PASTA_ICONES, variante.arquivo);
      // `omitBackground` preserva os cantos transparentes das variantes com
      // fundo arredondado; nas opacas o próprio SVG pinta o quadrado todo.
      await pagina.screenshot({ path: caminho, omitBackground: true });
      console.log(`Gerado ${caminho}`);
    }
  } finally {
    await navegador.close();
  }
}

function gerarSvgFavicon() {
  // Vetor: o lado é só a unidade de desenho, escala livremente. Mesmo
  // estilo do `any` (fundo com cantos arredondados e transparentes, caixa
  // do glifo de 60%).
  const svg = montarSvg({ lado: 100, opaco: false, caixaPercentual: 0.6 });
  const caminho = join(PASTA_ICONES, 'icone.svg');
  writeFileSync(caminho, `${svg.trim()}\n`, 'utf8');
  console.log(`Gerado ${caminho}`);
}

async function main() {
  mkdirSync(PASTA_ICONES, { recursive: true });
  const gitkeep = join(PASTA_ICONES, '.gitkeep');
  if (existsSync(gitkeep)) {
    rmSync(gitkeep);
  }
  gerarSvgFavicon();
  await gerarPngs();
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
