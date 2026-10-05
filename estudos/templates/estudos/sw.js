{% load estaticos %}/* Service worker: o que faz o app instalar e sobreviver ao metrô.

   Revisar é atividade de fila de ônibus, e fila de ônibus tem sinal ruim. Sem
   isto, o app no celular é uma aba que mostra erro de rede; com isto, é um
   ícone na tela inicial que abre a última tela mesmo sem sinal.

   A regra de cache aqui é a de `middleware.py` levada a sério, não contrariada:

   - `/static/`: cache primeiro. A URL já tem `?v=<mtime>`, então um arquivo
     novo é uma URL nova e nunca há o que invalidar.
   - navegação (HTML): rede primeiro, cache só quando a rede falha. É o que
     mantém a promessa do `no-store` — nunca mostrar uma tela velha sem saber
     que é velha — e ainda assim abrir algo offline. Online, o cache nunca é
     consultado.
   - `/api/`: rede e nada mais. Uma fila de revisão de ontem seria pior que um
     erro, porque parece certa.

   O nome do cache carrega a versão do CSS: mudar o visual aposenta o cache
   inteiro, e o `activate` apaga os antigos. */

const VERSAO = '{% estatico "css/estilo.css" %}';
const CACHE = 'estudos::' + VERSAO;

const OFFLINE = `<!doctype html>
<html lang="pt-br"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sem conexão · Estudos</title>
<body style="font: 16px/1.5 system-ui; margin: 10vh auto; max-width: 30rem; padding: 0 1rem">
<h1 style="font-size: 1.25rem">Sem conexão com o servidor</h1>
<p>O app roda na sua máquina: ligue o <code>runserver</code> e recarregue.</p>
</body></html>`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

// Guardar só o que vale guardar: resposta boa, da nossa origem e não redirecionada
// (o `/agora/` é um redirect, e a Cache API recusa um desses).
async function guardar(pedido, resposta) {
  if (!resposta || !resposta.ok || resposta.redirected) return;
  const cache = await caches.open(CACHE);
  await cache.put(pedido, resposta.clone());
}

async function doCache(pedido) {
  const guardada = await caches.match(pedido);
  if (guardada) return guardada;
  const resposta = await fetch(pedido);
  await guardar(pedido, resposta);
  return resposta;
}

async function daRede(pedido) {
  try {
    const resposta = await fetch(pedido);
    await guardar(pedido, resposta);
    return resposta;
  } catch (erro) {
    const guardada = await caches.match(pedido);
    if (guardada) return guardada;
    return new Response(OFFLINE, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;

  const url = new URL(pedido.url);
  if (url.origin !== location.origin) return;

  // Nunca de cache: dados de agora, arquivos anexados e o próprio worker.
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/arquivos/')) return;
  if (url.pathname === '/sw.js') return;

  if (url.pathname.startsWith('/static/')) {
    evento.respondWith(doCache(pedido));
    return;
  }

  if (pedido.mode === 'navigate') {
    evento.respondWith(daRede(pedido));
  }
});
