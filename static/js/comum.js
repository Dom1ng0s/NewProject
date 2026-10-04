/* Base de todas as telas: rede, DOM, formatacao e feedback.
   Nada aqui usa alert/confirm/prompt do navegador. */

// ----------------------------------------------------------------- rede

async function pegar(url) {
  const resposta = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resposta.ok) throw new Error('Não consegui carregar os dados.');
  return resposta.json();
}

async function enviar(url, dados) {
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados || {}),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.erro || 'A operação não foi concluída.');
  return corpo;
}

// ----------------------------------------------------------------- DOM

function el(tag, props, filhos) {
  const node = document.createElement(tag);
  const { dataset, style, ...resto } = props || {};

  for (const [chave, valor] of Object.entries(resto)) {
    // aria-* e afins nao sao propriedades do elemento; vao como atributo
    if (chave.includes('-')) node.setAttribute(chave, valor);
    else node[chave] = valor;
  }

  if (dataset) Object.assign(node.dataset, dataset);

  for (const [chave, valor] of Object.entries(style || {})) {
    // variaveis CSS (--x) so entram por setProperty
    if (chave.startsWith('--')) node.style.setProperty(chave, valor);
    else node.style[chave] = valor;
  }

  (filhos || []).forEach((f) => f != null && node.append(f));
  return node;
}

// Trechos de SVG reaproveitados; ver os mesmos icones em base.html.
const TRACOS = {
  pasta: 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 2H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z',
  'pasta-aberta': 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 2H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z M2 10h20',
  folha: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6',
  certo: 'M20 6 9 17l-5-5',
  alerta: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L14.7 3.9a2 2 0 0 0-3.4 0z',
  info: 'M12 16v-4m0-4h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  vazio: 'M3 7h18M3 12h18M3 17h10',
  mais: 'M12 5v14M5 12h14',
  lixo: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  fechar: 'M18 6 6 18M6 6l12 12',
  cartao: 'M3 5h18v14H3z M3 10h18',
};

function icone(nome, classe) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (classe) svg.setAttribute('class', classe);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', TRACOS[nome] || '');
  svg.append(path);
  return svg;
}

function ponto(cor) {
  return el('span', { className: 'ponto', style: { background: cor } });
}

// Estado vazio: um componente, uma voz. O texto diz o que fazer, nao faz graca.
function vazio(texto, compacto) {
  return el('p', { className: 'vazio' + (compacto ? ' vazio-compacto' : '') }, [
    icone('vazio'),
    el('span', { textContent: texto }),
  ]);
}

// ----------------------------------------------------------------- formatacao

function minutosParaTexto(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

function plural(n, singular, plural_) {
  return `${n} ${n === 1 ? singular : plural_}`;
}

function dataBr(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// ----------------------------------------------------------------- avisos

const ICONE_DO_AVISO = { ok: 'certo', erro: 'alerta', info: 'info' };

/* Aviso de canto, no lugar do alert(). `tipo` e 'ok' | 'erro' | 'info'. */
function avisar(texto, tipo = 'info') {
  const pilha = document.getElementById('pilha-avisos');
  if (!pilha) return;

  const caixa = el('div', { className: `aviso aviso-${tipo}` }, [
    icone(ICONE_DO_AVISO[tipo] || 'info'),
    el('span', { className: 'texto', textContent: texto }),
  ]);

  pilha.append(caixa);
  setTimeout(() => {
    caixa.classList.add('saindo');
    caixa.addEventListener('animationend', () => caixa.remove(), { once: true });
  }, tipo === 'erro' ? 6000 : 3500);
}

// Qualquer promessa que falhe termina aqui, com a mensagem visivel na tela.
function reclamar(erro) {
  avisar(erro.message || 'Algo deu errado.', 'erro');
}

// ----------------------------------------------------------------- dialogos

function abrirDialogo(conteudo, aoAbrir) {
  const dialogo = el('dialog', { className: 'dialogo' }, conteudo);
  document.body.append(dialogo);
  dialogo.addEventListener('close', () => dialogo.remove());
  dialogo.showModal();
  if (aoAbrir) aoAbrir(dialogo);
  return dialogo;
}

/* Confirmacao no lugar do confirm(). Resolve para true/false.
   `perigo` pinta o botao de acao como destrutivo. */
function confirmar(titulo, { detalhe = '', acao = 'Confirmar', perigo = false } = {}) {
  return new Promise((resolve) => {
    let decidido = false;
    const responder = (valor) => {
      decidido = true;
      resolve(valor);
      dialogo.close();
    };

    const cancelar = el('button', {
      className: 'botao botao-discreto',
      textContent: 'Cancelar',
      onclick: () => responder(false),
    });
    const confirmarBotao = el('button', {
      className: 'botao' + (perigo ? ' botao-perigo' : ''),
      textContent: acao,
      onclick: () => responder(true),
    });

    const dialogo = abrirDialogo(
      [
        el('h2', { textContent: titulo }),
        detalhe ? el('p', { textContent: detalhe }) : null,
        el('div', { className: 'dialogo-acoes' }, [cancelar, confirmarBotao]),
      ],
      () => confirmarBotao.focus()
    );

    // Esc fecha sem confirmar
    dialogo.addEventListener('close', () => decidido || resolve(false));
  });
}

/* Entrada de texto no lugar do prompt(). Resolve com a string ou null. */
function perguntar(titulo, { detalhe = '', acao = 'Adicionar', valor = '', dica = '' } = {}) {
  return new Promise((resolve) => {
    let decidido = false;
    const campo = el('input', { type: 'text', value: valor, placeholder: dica });

    const responder = (texto) => {
      decidido = true;
      resolve(texto);
      dialogo.close();
    };

    const formulario = el('form', {
      onsubmit: (e) => {
        e.preventDefault();
        const texto = campo.value.trim();
        if (texto) responder(texto);
      },
    }, [
      el('h2', { textContent: titulo }),
      detalhe ? el('p', { textContent: detalhe }) : null,
      campo,
      el('div', { className: 'dialogo-acoes' }, [
        el('button', {
          type: 'button',
          className: 'botao botao-discreto',
          textContent: 'Cancelar',
          onclick: () => responder(null),
        }),
        el('button', { type: 'submit', className: 'botao', textContent: acao }),
      ]),
    ]);

    const dialogo = abrirDialogo([formulario], () => campo.focus());
    dialogo.addEventListener('close', () => decidido || resolve(null));
  });
}

// ----------------------------------------------------------------- busca

/* Busca global: procura em matérias, tópicos, notas, cartões, material,
   avaliações e planner. Vive no topo, então está em todas as telas. */

function mostrarBusca(dados, alvo) {
  alvo.replaceChildren();

  if (dados.termo.length < 2) {
    alvo.append(el('p', { className: 'ajuda', textContent: 'Digite pelo menos duas letras.' }));
    return;
  }

  if (!dados.total) {
    alvo.append(vazio(`Nada encontrado para "${dados.termo}".`, true));
    return;
  }

  dados.grupos.forEach((g) => {
    alvo.append(el('h3', { className: 'busca-grupo', textContent: g.nome }));
    g.itens.forEach((i) => {
      alvo.append(
        el('a', {
          className: 'busca-item',
          href: i.url,
          target: i.externo ? '_blank' : '',
          rel: i.externo ? 'noreferrer' : '',
        }, [
          ponto(i.cor),
          el('span', { className: 'cresce' }, [
            el('span', { className: 'titulo', textContent: i.titulo }),
            i.detalhe ? el('small', { textContent: i.detalhe }) : null,
          ]),
        ])
      );
    });
  });
}

function abrirBusca(termoInicial) {
  const campo = el('input', {
    type: 'search',
    value: termoInicial || '',
    placeholder: 'Buscar em tudo',
    'aria-label': 'Buscar em tudo',
    autocomplete: 'off',
  });
  const resultados = el('div', { className: 'busca-resultados' });

  let pedido = 0;
  async function procurar() {
    const meu = ++pedido;
    const termo = campo.value.trim();
    if (termo.length < 2) {
      mostrarBusca({ termo, grupos: [], total: 0 }, resultados);
      return;
    }
    try {
      const dados = await pegar(`/api/busca/?q=${encodeURIComponent(termo)}`);
      // Resposta de uma digitação já abandonada não pode sobrescrever a atual.
      if (meu === pedido) mostrarBusca(dados, resultados);
    } catch (erro) {
      reclamar(erro);
    }
  }

  let agendado;
  campo.oninput = () => {
    clearTimeout(agendado);
    agendado = setTimeout(procurar, 180);
  };

  const formulario = el('form', { onsubmit: (e) => e.preventDefault() }, [
    el('h2', { textContent: 'Buscar' }),
    campo,
    resultados,
    el('div', { className: 'dialogo-acoes' }, [
      el('button', {
        type: 'button',
        className: 'botao botao-discreto',
        textContent: 'Fechar',
        onclick: () => dialogo.close(),
      }),
    ]),
  ]);

  const dialogo = abrirDialogo([formulario], () => {
    campo.focus();
    campo.select();
  });
  dialogo.classList.add('dialogo-busca');
  procurar();
  return dialogo;
}

// ----------------------------------------------------------------- atalhos

/* Um teclado, um handler. O diálogo de revisão já provou que a tecla vale mais
   que o clique numa fila de vinte; aqui o resto do app ganha o mesmo.

   `g` abre um acorde: `g` depois `r` vai para "Revisar hoje". Cada tela
   registra o que é só dela com `registrarAtalhos`, e todos aparecem no `?`. */

const IR_PARA = [
  ['d', '/', 'Dashboard'],
  ['s', '/sessao/', 'Sessão de estudo'],
  ['r', '/revisar/', 'Revisar hoje'],
  ['m', '/materias/', 'Matérias e tópicos'],
  ['p', '/planner/', 'Planner semanal'],
  ['a', '/avaliacoes/', 'Provas e prazos'],
  ['q', '/quadro/', 'Quadro'],
  ['h', '/historico/', 'Histórico'],
  ['c', '/configuracoes/', 'Configurações'],
  ['b', '/dados/', 'Dados e backup'],
];

// Quanto tempo o `g` espera a segunda tecla. Passou disso, foi um `g` perdido.
const ESPERA_DO_ACORDE = 1500;

// Atalhos da tela aberta: { tecla: { rotulo, acao } }.
const atalhosDaTela = new Map();

/* Registra atalhos da tela atual. Chamar de novo troca o que havia: uma tela
   que redesenha não acumula handlers do que já saiu do DOM. */
function registrarAtalhos(mapa) {
  atalhosDaTela.clear();
  for (const [tecla, def] of Object.entries(mapa || {})) atalhosDaTela.set(tecla, def);
}

function digitando() {
  const ativo = document.activeElement;
  if (!ativo) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(ativo.tagName) || ativo.isContentEditable;
}

function mostrarAtalhos() {
  const linha = (teclas, texto) =>
    el('div', { className: 'atalho-linha' }, [
      el('span', { className: 'atalho-teclas' }, teclas.map((t) => el('kbd', { textContent: t }))),
      el('span', { className: 'cresce', textContent: texto }),
    ]);

  const corpo = [
    el('h2', { textContent: 'Atalhos' }),
    el('h3', { className: 'busca-grupo', textContent: 'Em qualquer tela' }),
    linha(['/'], 'Buscar em tudo'),
    linha(['n'], 'Nova sessão de estudo'),
    linha(['?'], 'Esta lista'),
    el('h3', { className: 'busca-grupo', textContent: 'Ir para (g e a letra)' }),
    ...IR_PARA.map(([tecla, , nome]) => linha(['g', tecla], nome)),
  ];

  if (atalhosDaTela.size) {
    corpo.push(el('h3', { className: 'busca-grupo', textContent: 'Nesta tela' }));
    for (const [tecla, def] of atalhosDaTela) corpo.push(linha([tecla], def.rotulo));
  }

  const fechar = el('button', {
    type: 'button',
    className: 'botao botao-discreto',
    textContent: 'Fechar',
    onclick: () => dialogo.close(),
  });
  corpo.push(el('div', { className: 'dialogo-acoes' }, [fechar]));

  const dialogo = abrirDialogo(corpo, () => fechar.focus());
  dialogo.classList.add('dialogo-atalhos');
  return dialogo;
}

function ligarAtalhos() {
  let esperandoDestino = false;
  let relogio = null;

  const esquecerAcorde = () => {
    esperandoDestino = false;
    clearTimeout(relogio);
  };

  document.addEventListener('keydown', (evento) => {
    // Atalho de uma letra não pode roubar a tecla de quem está escrevendo, nem
    // atropelar um diálogo aberto (a revisão tem as teclas dela).
    if (evento.ctrlKey || evento.altKey || evento.metaKey) return;
    if (digitando() || document.querySelector('dialog[open]')) return;

    if (esperandoDestino) {
      const destino = IR_PARA.find(([tecla]) => tecla === evento.key);
      esquecerAcorde();
      if (destino) {
        evento.preventDefault();
        location.href = destino[1];
      }
      return;
    }

    if (evento.key === 'g') {
      esperandoDestino = true;
      relogio = setTimeout(esquecerAcorde, ESPERA_DO_ACORDE);
      return;
    }

    if (evento.key === '/') {
      evento.preventDefault();
      abrirBusca('');
      return;
    }

    if (evento.key === '?') {
      evento.preventDefault();
      mostrarAtalhos();
      return;
    }

    if (evento.key === 'n') {
      evento.preventDefault();
      location.href = '/sessao/';
      return;
    }

    const daTela = atalhosDaTela.get(evento.key);
    if (daTela) {
      evento.preventDefault();
      daTela.acao();
    }
  });
}

// ----------------------------------------------------------------- shell

// O tema ja foi aplicado no <head> para nao piscar; aqui so fica a troca.
document.addEventListener('DOMContentLoaded', () => {
  const temaBotao = document.getElementById('tema-botao');
  if (temaBotao) {
    temaBotao.addEventListener('click', () => {
      const novo = document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro';
      document.documentElement.dataset.tema = novo;
      try {
        localStorage.setItem('tema', novo);
      } catch (e) { /* sem localStorage: vale so nesta aba */ }
    });
  }

  const busca = document.getElementById('busca');
  if (busca) {
    const campo = document.getElementById('busca-campo');
    // O campo do topo é só a porta: quem busca de verdade é o diálogo.
    const abrir = () => {
      // Em tela estreita o campo some e sobra a lupa; os dois chamam daqui, e
      // o dialogo ja aberto nao pode abrir de novo.
      if (document.querySelector('dialog[open]')) return;
      const termo = campo.value;
      campo.value = '';
      campo.blur();
      abrirBusca(termo);
    };
    busca.onsubmit = (e) => {
      e.preventDefault();
      abrir();
    };
    campo.onfocus = abrir;
    busca.onclick = abrir;
  }

  ligarAtalhos();

  const menuBotao = document.getElementById('menu-botao');
  const lateral = document.getElementById('lateral');
  if (menuBotao && lateral) {
    menuBotao.addEventListener('click', () => {
      const aberta = lateral.classList.toggle('aberta');
      menuBotao.setAttribute('aria-expanded', String(aberta));
    });
  }
});
