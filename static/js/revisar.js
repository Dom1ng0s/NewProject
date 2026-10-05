/* Revisar hoje: tenta lembrar antes de ver a resposta, e a nota decide quando
   o tópico volta. As quatro notas são as do SM-2: errei, difícil, bom, fácil. */

/* Aparelho de toque: sem teclado, as dicas "(1)" e "(espaço)" nos botões não
   ajudam ninguém e encurtam o rótulo numa tela de 390px. */
const NO_DEDO = window.matchMedia('(pointer: coarse)').matches;

// A tecla é o atalho: numa fila de 20 cartões, a mão não volta para o mouse.
const NOTAS = [
  ['errei', 'Errei', 'botao-perigo botao-discreto', '1'],
  ['dificil', 'Difícil', 'botao-fantasma', '2'],
  ['bom', 'Bom', 'botao-discreto', '3'],
  ['facil', 'Fácil', 'botao-discreto', '4'],
];

// Topico que cai numa prova proxima vem primeiro na fila e ganha a etiqueta.
function etiquetaDaProva(dias) {
  if (dias === null || dias === undefined) return null;
  const texto = dias === 0 ? 'prova hoje' : dias < 0 ? 'prova passou' : `prova em ${dias}d`;
  return el('span', {
    className: 'etiqueta' + (dias >= 0 && dias <= 3 ? ' etiqueta-alerta' : ''),
    textContent: texto,
  });
}

function quando(dias) {
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return `em ${plural(dias, 'dia', 'dias')}`;
}

/* O degrau que a nota acabou de mover.

   É a única recompensa que esta tela tem para dar, e ela é verdadeira: não é
   um ponto inventado, é a escada do SM-2 andando. "1 → 6 dias" diz mais do que
   qualquer parabéns, porque diz o que mudou. */
function escadaEmPalavras(antes, depois) {
  if (!antes) return `entra na escada: volta ${quando(depois)}`;
  if (depois > antes) return `${antes} → ${depois} dias`;
  if (depois < antes) return `caiu de ${antes} para ${depois} dias`;
  return `segue em ${plural(depois, 'dia', 'dias')}`;
}

/* A fila corre sozinha: respondeu um cartão, o próximo abre.

   Entre dois cartões não cabe uma tela de lista — é ali que se fecha o app. A
   corrida começa ao clicar "Revisar" ou ao chegar com `?iniciar=1` (o atalho
   da tela inicial, o botão do dashboard), e só para quando a fila zera ou
   quando a pessoa fecha o cartão: fechar é "chega por hoje", e reabrir sozinho
   depois disso seria sequestro, não comodidade. */
let correndo = new URLSearchParams(location.search).get('iniciar') === '1';
if (correndo) {
  // A URL já cumpriu o papel; um F5 não recomeça a corrida sem pedir.
  history.replaceState(null, '', location.pathname);
}

/* De onde o anel parte quando a fila fecha. Guardar o percentual da carga
   anterior é mais simples e mais honesto que recalcular: é literalmente onde o
   anel estava na tela um instante antes da última resposta. */
let percentualAnterior = 0;

// ---------------------------------------------------------------- revisão

/* Abre a revisão: mostra a pergunta, espera, revela a resposta e só então
   pergunta como foi. Tópico sem cartão nenhum vai direto para as notas — o
   app não obriga a escrever cartão para continuar usando a revisão. */
async function revisar(r) {
  const { cartoes } = await pegar(`/api/revisoes/${r.id}/cartoes/`);

  correndo = true;
  let indice = 0;
  let revelado = false;
  let respondeu = false;

  const titulo = el('h2', { textContent: `${r.materia} · ${r.topico}` });
  const contador = el('p', { className: 'ajuda' });
  const frente = el('p', { className: 'cartao-frente' });
  const verso = el('p', { className: 'cartao-verso' });
  const acoes = el('div', { className: 'dialogo-acoes' });

  const dialogo = abrirDialogo([
    titulo,
    contador,
    el('div', { className: 'cartao-palco' }, [frente, verso]),
    acoes,
  ]);

  function botao(rotulo, classe, aoClicar, tecla) {
    return el('button', {
      type: 'button',
      className: `botao ${classe}`,
      // No celular não há tecla para apertar; a dica só rouba largura do rótulo.
      textContent: tecla && !NO_DEDO ? `${rotulo} (${tecla})` : rotulo,
      onclick: aoClicar,
    });
  }

  // Espaço revela a resposta ou avança; 1 a 4 respondem. Só vale quando a nota
  // faz sentido, senão "4" fecharia a revisão antes de ver o cartão.
  function teclar(evento) {
    if (evento.key === 'Escape') return; // o <dialog> já trata
    const cartao = cartoes[indice];

    if (evento.key === ' ' || evento.key === 'Enter') {
      evento.preventDefault();
      if (cartao && !revelado) {
        revelado = true;
        desenharCartao();
      } else if (cartao && indice < cartoes.length - 1) {
        indice += 1;
        revelado = false;
        desenharCartao();
      }
      return;
    }

    const nota = NOTAS.find(([, , , tecla]) => tecla === evento.key);
    if (nota && (!cartao || (revelado && indice === cartoes.length - 1))) {
      evento.preventDefault();
      responder(nota[0]);
    }
  }

  async function responder(resposta) {
    try {
      const saida = await enviar(`/api/revisoes/${r.id}/responder/`, { resposta });
      respondeu = true;
      dialogo.close();
      // O degrau movido é a recompensa; a saída para a nota errada vem junto,
      // porque ela é fácil de dar e cara de manter.
      avisar(
        `${r.topico}: ${escadaEmPalavras(saida.intervalo_antes, saida.intervalo_depois)}. ` +
          'Errou a nota? "u" desfaz.',
        'ok'
      );
      carregar();
    } catch (erro) {
      reclamar(erro);
    }
  }

  function desenharCartao() {
    const cartao = cartoes[indice];
    contador.textContent = cartoes.length
      ? `Cartão ${indice + 1} de ${cartoes.length}`
      : 'Este tópico ainda não tem cartões. Relembre pelo caderno e responda como foi.';
    frente.textContent = cartao ? cartao.frente : '';
    verso.textContent = cartao && revelado ? cartao.verso : '';
    verso.hidden = !revelado;

    acoes.replaceChildren();

    if (cartao && !revelado) {
      acoes.append(
        botao('Fechar', 'botao-discreto', () => dialogo.close()),
        botao('Mostrar resposta', '', () => {
          revelado = true;
          desenharCartao();
        }, 'espaço')
      );
      return;
    }

    if (cartao && indice < cartoes.length - 1) {
      acoes.append(
        botao('Fechar', 'botao-discreto', () => dialogo.close()),
        botao('Próximo cartão', '', () => {
          indice += 1;
          revelado = false;
          desenharCartao();
        }, 'espaço')
      );
      return;
    }

    // Último cartão (ou nenhum): hora de dizer como foi.
    acoes.append(
      ...NOTAS.map(([valor, rotulo, classe, tecla]) =>
        botao(rotulo, classe, () => responder(valor), tecla)
      )
    );
  }

  desenharCartao();
  dialogo.addEventListener('keydown', teclar);
  // Fechar sem responder é "chega por hoje": a corrida para aqui.
  dialogo.addEventListener('close', () => {
    if (!respondeu) correndo = false;
  });
}

// ---------------------------------------------------------------- lista

function desenhar(itens) {
  const alvo = document.getElementById('fila');
  document.getElementById('n-fila').textContent = itens.length;
  alvo.replaceChildren();

  if (!itens.length) {
    alvo.append(vazio('Nada para revisar hoje.', true));
    return;
  }

  itens.forEach((r) => {
    alvo.append(
      el('div', { className: 'item' }, [
        ponto(r.cor),
        el('div', { className: 'cresce' }, [
          el('span', { textContent: `${r.materia} · ${r.topico}` }),
          el('small', {
            textContent:
              (r.atrasada ? 'atrasada desde ' : 'prevista para ') +
              dataBr(r.data_prevista) +
              ' · ' +
              (r.cartoes ? plural(r.cartoes, 'cartão', 'cartões') : 'sem cartões'),
          }),
        ]),
        etiquetaDaProva(r.prova_dias),
        el('button', {
          type: 'button',
          className: 'botao botao-mini',
          textContent: 'Revisar',
          onclick: () => revisar(r).catch(reclamar),
        }),
      ])
    );
  });
}

function resumo(d) {
  const partes = [];
  if (d.atrasadas) partes.push(plural(d.atrasadas, 'atrasada', 'atrasadas'));
  if (d.hoje) partes.push(`${d.hoje} de hoje`);
  return partes.join(' · ');
}

/* O progresso do dia como um anel que fecha, e a dívida atrás de um toque.

   O que estava na manchete era a dívida: "23 esperando" todo dia, um número
   que nunca zera. Fila que não fecha é fila que se abandona — então a conta
   grande é a do dia, que chega a 100%, e o excedente continua existindo numa
   linha que só aparece para quem perguntar. Esconder não é mentir: é pôr o
   número que decide alguma coisa hoje na frente do que não decide. */
function desenharProgresso(d) {
  const p = d.progresso;
  const alvo = document.getElementById('progresso');
  const rotulo = p.total
    ? `${p.feitas} de ${p.total} revisões de hoje`
    : 'nada marcado para hoje';

  const linhas = [
    el('strong', {
      className: 'progresso-conta',
      textContent: p.total ? `${p.feitas} / ${p.total}` : 'livre',
    }),
    el('span', { className: 'ajuda', textContent: resumo(d) || 'fila de hoje fechada' }),
  ];

  if (d.esperando) {
    const detalhe = el('p', {
      className: 'ajuda progresso-divida',
      hidden: true,
      textContent:
        `${plural(d.esperando, 'revisão', 'revisões')} além do teto de ` +
        `${d.maximo_por_dia}/dia — ${d.esperando === 1 ? 'volta' : 'voltam'} amanhã, ` +
        'na ordem da prova mais próxima.',
    });
    const abrir = el('button', {
      type: 'button',
      className: 'botao botao-fantasma botao-mini',
      textContent: `+${d.esperando} depois`,
      'aria-expanded': 'false',
      onclick: () => {
        detalhe.hidden = !detalhe.hidden;
        abrir.setAttribute('aria-expanded', String(!detalhe.hidden));
      },
    });
    linhas.push(abrir, detalhe);
  }

  alvo.replaceChildren(
    anelProgresso(p.percentual, p.total ? `${p.percentual}%` : '—', rotulo),
    el('div', { className: 'progresso-texto cresce' }, linhas)
  );
}

/* Fila zerada: o fim da tarefa dito como fim, uma vez só.

   É o momento que o anel existe para produzir. Sem ele, terminar a fila é
   indistinguível de desistir dela — a tela fica igual nos dois casos.

   Era um aviso de canto, que some em três segundos e concorre com o próximo
   cartão. Agora é um diálogo: o anel fecha de onde estava até 100%, a sequência
   aparece inteira, e a dívida continua dita no fim, em letra miúda. O anel
   partir do percentual anterior é o recado todo — é o movimento que diz que
   acabou, não o texto. */
function celebrar(d) {
  celebrarFechamento({
    progresso: d.progresso,
    sequencia: d.sequencia,
    esperando: d.esperando,
    antes: percentualAnterior,
    acao: { href: '/', rotulo: 'Ver o dashboard' },
  });
  // Uma nota pode ter levado um tópico a 90 dias de intervalo; é um marco, e
  // ele só existe por causa da resposta que acabou de ser dada.
  conferirMarcos();
}

// ---------------------------------------------------------------- desfazer

/* Um "1" no lugar de um "3" derruba a facilidade e o intervalo do tópico, e já
   agenda a próxima revisão no dia errado. Sem desfazer, a única saída seria
   mexer no banco. */
async function desfazer() {
  try {
    const d = await enviar('/api/revisoes/desfazer/');
    avisar(`Nota desfeita: ${d.topico} voltou para a fila.`, 'ok');
    carregar();
  } catch (erro) {
    reclamar(erro);
  }
}

const NOTA_DO_SM2 = { 0: 'errei', 3: 'difícil', 4: 'bom', 5: 'fácil' };

function desenharDesfazer(ultima) {
  const alvo = document.getElementById('desfazer');
  alvo.replaceChildren();
  if (!ultima) return;

  alvo.append(
    el('span', {
      className: 'ajuda cresce',
      textContent: `Última nota: ${ultima.materia} · ${ultima.topico} — ${
        NOTA_DO_SM2[ultima.qualidade] || ultima.qualidade
      }`,
    }),
    el('button', {
      type: 'button',
      className: 'botao botao-discreto botao-mini',
      textContent: NO_DEDO ? 'Desfazer' : 'Desfazer (u)',
      onclick: () => desfazer(),
    })
  );
}

async function carregar() {
  const d = await pegar('/api/revisoes/hoje/');
  desenhar(d.fila);
  desenharProgresso(d);
  desenharDesfazer(d.ultima_resposta);

  if (!correndo) {
    percentualAnterior = d.progresso.percentual;
    return;
  }
  if (d.fila.length) {
    // O próximo cartão abre sozinho: entre dois cartões não cabe uma lista.
    await revisar(d.fila[0]);
    return;
  }
  correndo = false;
  if (d.progresso.fechou_agora) celebrar(d);
  percentualAnterior = d.progresso.percentual;
}

registrarAtalhos({ u: { rotulo: 'Desfazer a última nota', acao: desfazer } });

carregar().catch(reclamar);
