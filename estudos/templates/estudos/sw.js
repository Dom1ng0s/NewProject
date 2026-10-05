{% load estaticos %}/* Service worker: o que faz o app instalar e sobreviver ao metrô.

   Revisar é atividade de fila de ônibus, e fila de ônibus tem sinal ruim. Sem
   isto, o app no celular é uma aba que mostra erro de rede; com isto, é um
   ícone na tela inicial que abre a última tela mesmo sem sinal.

   A regra de cache aqui é a de `middleware.py` levada a sério, não contrariada:

   - `/static/` **com `?v=`**: cache primeiro. A URL carrega o mtime, então um
     arquivo novo é uma URL nova e nunca há o que invalidar.
   - `/static/` **sem `?v=`**: rede primeiro. Quem versiona é quem escreve a
     URL, e o `@import` dentro de `estilo.css` não versiona nada: os pedidos de
     `tokens.css`, `base.css`, `componentes.css` e `telas.css` saem sempre no
     mesmo endereço. Guardados cache-primeiro, eles sobrevivem à própria edição
     -- o `?v=` do `estilo.css` muda (ele usa o mtime mais recente de tudo o que
     importa), o navegador baixa a folha de entrada nova, e ela volta a importar
     a versão velha das partes. O CSS antigo com cara de bug é exatamente o que
     o `?v=` existe para evitar.
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

/* ----------------------------------------------------------- lembrete

   O único jeito de o app lembrar de estudar com a aba fechada, sem pôr um
   servidor de push no meio de algo que roda na própria máquina.

   `periodicSync` existe hoje só em PWA instalado no Chrome, e o navegador
   decide a hora de verdade -- pedimos um intervalo mínimo e ele acorda quando
   quer. Onde não existe, o lembrete continua valendo ao abrir o app
   (`conferirLembrete`, em comum.js). É pouco e é honesto: não há promessa de
   push aqui.

   Quem decide se há o que dizer é o servidor, em `/api/lembrete/`: o worker não
   repete regra nenhuma, só entrega o texto que vier -- e texto vazio não vira
   notificação, porque notificação sem conteúdo é o que ensina a ignorar as
   próximas. */

async function lembrar() {
  try {
    const resposta = await fetch('/api/lembrete/', {
      headers: { Accept: 'application/json' },
    });
    if (!resposta.ok) return;
    const d = await resposta.json();
    if (!d.ativo || !d.vale_lembrar || !d.texto) return;
    await self.registration.showNotification('Estudos', {
      body: d.texto,
      tag: 'lembrete',
      icon: '/static/icone-192.png',
      badge: '/static/icone-192.png',
    });
  } catch (erro) { /* sem servidor no ar: não há lembrete a dar */ }
}

self.addEventListener('periodicsync', (evento) => {
  if (evento.tag === 'lembrete') evento.waitUntil(lembrar());
});

/* Clicar no lembrete abre o app já estudando, e não uma aba qualquer: `/agora/`
   é a mesma porta do atalho da tela inicial. Uma aba já aberta é reaproveitada
   -- abrir a quinta aba do mesmo app é o que faz a pessoa fechar todas. */
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(
    (async () => {
      const abertas = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const aba of abertas) {
        if (new URL(aba.url).origin === location.origin) {
          await aba.focus();
          return;
        }
      }
      await self.clients.openWindow('/agora/');
    })()
  );
});

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
    // Sem `?v=` não há como saber se o guardado é o de agora: ver o comentário
    // do topo, e os `@import` de `estilo.css`, que são justamente este caso.
    evento.respondWith(url.searchParams.has('v') ? doCache(pedido) : daRede(pedido));
    return;
  }

  if (pedido.mode === 'navigate') {
    evento.respondWith(daRede(pedido));
  }
});
