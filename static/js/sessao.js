const painel = document.getElementById('painel-cronometro');
const mostrador = document.getElementById('mostrador');
const faseAtual = document.getElementById('fase-atual');
const cicloAtual = document.getElementById('ciclo-atual');
const CHAVE = 'cronometro';

const PAUSA_LONGA = Number(painel.dataset.pausaLonga) || 15;
const CICLOS = Number(painel.dataset.ciclos) || 4;
const TITULO = document.title;

/* Estado no localStorage para sobreviver ao recarregar:
   { topico_id, modo, foco, pausa, inicio (ms), acumulado (ms), rodando, fase,
     ciclos (focos concluídos), interrupcoes } */
let estado = lerEstado();
let tique = null;

function lerEstado() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || 'null');
  } catch (e) {
    return null;
  }
}

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch (e) { /* sem localStorage: o cronometro vale so nesta aba */ }
}

function limpar() {
  estado = null;
  clearInterval(tique);
  try {
    localStorage.removeItem(CHAVE);
  } catch (e) { /* nada a limpar */ }
  desenhar();
}

/* O som da troca de fase mora em `comum.js` (`bipar`), junto com o do fim da
   fila: são a mesma interrupção sonora para quem está do lado, e quem silencia
   uma silencia as duas. */

function notificar(texto) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification('Estudos', { body: texto, tag: 'fase' });
  } catch (e) { /* notificação bloqueada: segue sem */ }
}

/* O aviso na tela some sozinho e a aba pode estar no fundo; por isso o som, a
   notificação do sistema e o tempo no título da aba. */
function anunciar(texto, tipo) {
  avisar(texto, tipo);
  if (!document.getElementById('avisar-fase').checked) return;
  bipar();
  notificar(texto);
}

function decorridoMs() {
  if (!estado) return 0;
  return estado.acumulado + (estado.rodando ? Date.now() - estado.inicio : 0);
}

function formatar(ms) {
  const total = Math.max(Math.floor(ms / 1000), 0);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function marcarFase(texto, classe) {
  faseAtual.textContent = texto;
  faseAtual.className = 'cronometro-fase' + (classe ? ' ' + classe : '');
}

// A pausa longa entra a cada `CICLOS` focos concluídos.
function pausaLonga() {
  return estado.ciclos > 0 && estado.ciclos % CICLOS === 0;
}

function minutosDaFase() {
  if (estado.fase === 'foco') return estado.foco;
  return pausaLonga() ? PAUSA_LONGA : estado.pausa;
}

function desenhar() {
  if (!estado) {
    mostrador.textContent = '00:00';
    marcarFase('Parado');
    cicloAtual.textContent = '';
    document.title = TITULO;
    return;
  }

  const decorrido = decorridoMs();

  if (estado.modo === 'pomodoro') {
    const restante = minutosDaFase() * 60000 - decorrido;
    mostrador.textContent = formatar(Math.max(restante, 0));
    if (estado.fase === 'foco') {
      marcarFase('Foco', estado.rodando ? 'fase-contando' : '');
      cicloAtual.textContent = `Ciclo ${(estado.ciclos % CICLOS) + 1} de ${CICLOS}`;
    } else {
      marcarFase(pausaLonga() ? 'Pausa longa' : 'Pausa', 'fase-pausa');
      cicloAtual.textContent = pausaLonga()
        ? `${CICLOS} ciclos fechados — ${PAUSA_LONGA} min de descanso`
        : `${plural(estado.ciclos, 'ciclo fechado', 'ciclos fechados')}`;
    }
    if (restante <= 0) trocarFase();
  } else {
    mostrador.textContent = formatar(decorrido);
    marcarFase(estado.rodando ? 'Contando' : 'Pausado', estado.rodando ? 'fase-contando' : '');
    cicloAtual.textContent = '';
  }

  // Aba em segundo plano: o tempo aparece no título.
  document.title = estado.rodando ? `${mostrador.textContent} · ${TITULO}` : TITULO;
}

function trocarFase() {
  // No pomodoro o tempo de foco vira minutos estudados; a pausa nao conta.
  if (estado.fase === 'foco') {
    estado.estudado_min = (estado.estudado_min || 0) + estado.foco;
    estado.ciclos = (estado.ciclos || 0) + 1;
    estado.fase = 'pausa';
    const longa = pausaLonga();
    anunciar(
      `Foco de ${estado.foco} min concluído. ` +
        (longa ? `Pausa longa de ${PAUSA_LONGA} min.` : 'Hora da pausa.'),
      'ok'
    );
  } else {
    estado.fase = 'foco';
    anunciar('Pausa encerrada. De volta ao foco.', 'info');
  }
  estado.acumulado = 0;
  estado.inicio = Date.now();
  salvar();
}

function mostrarInterrupcoes() {
  document.getElementById('n-interrupcoes').textContent = estado ? estado.interrupcoes || 0 : 0;
}

function ligarTique() {
  clearInterval(tique);
  tique = setInterval(desenhar, 500);
}

document.getElementById('iniciar').onclick = () => {
  const topico = document.getElementById('topico').value;
  if (!topico) {
    avisar('Escolha um tópico antes de começar.', 'erro');
    document.getElementById('topico').focus();
    return;
  }

  if (!estado) {
    estado = {
      topico_id: topico,
      modo: document.getElementById('modo').value,
      foco: Number(document.getElementById('min-foco').value) || 25,
      pausa: Number(document.getElementById('min-pausa').value) || 5,
      acumulado: 0,
      estudado_min: 0,
      ciclos: 0,
      interrupcoes: 0,
      fase: 'foco',
      rodando: false,
      criado: new Date().toISOString(),
    };
  }

  if (!estado.rodando) {
    estado.rodando = true;
    estado.inicio = Date.now();
    salvar();
  }

  // A permissão só pode ser pedida a partir de um clique; é aqui.
  if (
    document.getElementById('avisar-fase').checked &&
    'Notification' in window &&
    Notification.permission === 'default'
  ) {
    Notification.requestPermission().catch(() => {});
  }

  ligarTique();
  mostrarInterrupcoes();
  desenhar();
};

document.getElementById('interromper').onclick = () => {
  if (!estado) {
    avisar('Nenhum cronômetro em andamento.', 'erro');
    return;
  }
  estado.interrupcoes = (estado.interrupcoes || 0) + 1;
  salvar();
  mostrarInterrupcoes();
};

document.getElementById('pausar').onclick = () => {
  if (!estado || !estado.rodando) return;
  estado.acumulado = decorridoMs();
  estado.rodando = false;
  salvar();
  desenhar();
};

document.getElementById('descartar').onclick = async () => {
  if (!estado) return;
  const ok = await confirmar('Descartar o cronômetro?', {
    detalhe: `${formatar(decorridoMs())} contados não serão salvos.`,
    acao: 'Descartar',
    perigo: true,
  });
  if (!ok) return;
  limpar();
  avisar('Cronômetro descartado.', 'info');
};

document.getElementById('finalizar').onclick = async () => {
  if (!estado) {
    avisar('Nenhum cronômetro em andamento.', 'erro');
    return;
  }

  let minutos;
  if (estado.modo === 'pomodoro') {
    const parcial = estado.fase === 'foco' ? decorridoMs() / 60000 : 0;
    minutos = Math.round((estado.estudado_min || 0) + parcial);
  } else {
    minutos = Math.round(decorridoMs() / 60000);
  }
  if (minutos < 1) minutos = 1; // registra pelo menos 1 minuto

  try {
    const r = await enviar('/api/sessoes/criar/', {
      topico_id: estado.topico_id,
      duracao_min: minutos,
      nota: document.getElementById('nota').value,
      inicio: estado.criado,
      interrupcoes: estado.interrupcoes || 0,
    });

    limpar();
    document.getElementById('nota').value = '';
    mostrarResumoDaSessao(r.resumo, r.revisao_agendada);
    listar();
    // Um marco pode ter nascido desta sessão — o primeiro tópico dominado da
    // matéria, a matéria que voltou depois de um mês.
    conferirMarcos();
  } catch (erro) {
    reclamar(erro);
  }
};

/* O fim da sessão, com número.

   Antes isto era um aviso de canto: "Sessão de 50min salva." O cronômetro
   zerava, a lista ganhava uma linha e cinquenta minutos de esforço não
   apareciam em lugar nenhum. O que mantém alguém voltando não é a recompensa, é
   ver o próprio esforço virar um número que se move — e todos os números daqui
   já existiam no banco, só nunca tinham sido mostrados na hora em que mudaram.

   O foco comparado com a média é o único dado do app que ninguém mais tem: o
   contador de interrupções existe exatamente para responder isso, e até agora a
   resposta só aparecia no histórico, noventa dias depois. */
function mostrarResumoDaSessao(r, revisaoAgendada) {
  if (!r) return;

  const linhas = [
    el('p', { className: 'ajuda' }, [
      ponto(r.cor),
      el('span', { textContent: `${r.materia} · ${r.topico}` }),
    ]),
  ];

  // Interrupções contra o próprio histórico. Sem média não há comparação, e
  // inventar "0,0 de média" no primeiro dia seria criar um recorde falso.
  if (r.media_interrupcoes !== null) {
    const diferenca = r.interrupcoes - r.media_interrupcoes;
    const melhor = diferenca < -0.05;
    linhas.push(
      el('p', { className: 'resumo-linha' }, [
        el('span', {
          className: 'cresce',
          textContent: `${plural(r.interrupcoes, 'interrupção', 'interrupções')}`,
        }),
        el('span', {
          className: 'etiqueta' + (melhor ? ' etiqueta-ok' : ''),
          textContent: melhor
            ? `melhor que sua média de ${r.media_interrupcoes}`
            : `média de ${r.media_interrupcoes}`,
        }),
      ])
    );
  } else if (r.interrupcoes) {
    linhas.push(
      el('p', {
        className: 'ajuda',
        textContent: plural(r.interrupcoes, 'interrupção', 'interrupções'),
      })
    );
  }

  if (r.sessoes_do_dia > 1) {
    linhas.push(
      el('p', {
        className: 'ajuda',
        textContent: `${minutosParaTexto(r.minutos_do_dia)} no dia, em ${plural(
          r.sessoes_do_dia,
          'sessão',
          'sessões'
        )}.`,
      })
    );
  }

  // A meta da semana andando: o que falta dito em minutos, porque "faltam
  // 40 min" é uma frase acionável e "67% da meta" não é.
  if (r.meta_horas_semanais) {
    const medidor = el('div', { className: 'medidor' }, [
      el('div', {
        className: 'medidor-preenchido',
        style: { width: r.percentual_meta + '%' },
      }),
    ]);
    linhas.push(
      el('div', { className: 'resumo-meta' }, [
        el('p', { className: 'resumo-linha' }, [
          el('span', {
            className: 'cresce',
            textContent: `${r.horas_semana}h de ${r.meta_horas_semanais}h na semana`,
          }),
          r.bateu_meta
            ? el('span', { className: 'etiqueta etiqueta-ok', textContent: 'meta batida' })
            : el('span', {
                className: 'ajuda',
                textContent: `faltam ${minutosParaTexto(r.faltam_min)}`,
              }),
        ]),
        medidor,
      ])
    );
  }

  if (r.sequencia && r.sequencia.dias) {
    linhas.push(
      el('p', {
        className: 'ajuda',
        textContent:
          plural(r.sequencia.dias, 'dia seguido', 'dias seguidos') +
          (r.sequencia.semanas
            ? ` · ${plural(r.sequencia.semanas, 'semana', 'semanas')} na meta`
            : ''),
      })
    );
  }

  if (revisaoAgendada) {
    linhas.push(el('p', { className: 'ajuda', textContent: 'Primeira revisão agendada.' }));
  }

  const fechar = el('button', {
    type: 'button',
    className: 'botao',
    textContent: 'Fechar',
    onclick: () => dialogo.close(),
  });

  const dialogo = abrirDialogo(
    [
      el('p', { className: 'marco-rotulo', textContent: 'Sessão salva' }),
      el('h2', { className: 'resumo-tempo', textContent: minutosParaTexto(r.minutos) }),
      ...linhas,
      el('div', { className: 'dialogo-acoes' }, [
        el('a', { className: 'botao botao-discreto', href: '/revisar/', textContent: 'Revisar hoje' }),
        fechar,
      ]),
    ],
    () => fechar.focus()
  );
  dialogo.classList.add('dialogo-resumo');
  return dialogo;
}

async function preencherSeletores() {
  const [{ topicos }, { materias }] = await Promise.all([
    pegar('/api/topicos/'),
    pegar('/api/materias/'),
  ]);

  const sel = document.getElementById('topico');
  sel.replaceChildren(el('option', { value: '', textContent: 'Escolha um tópico' }));
  topicos.forEach((t) =>
    sel.append(el('option', { value: t.id, textContent: `${t.materia} · ${t.caminho}` }))
  );
  if (estado) sel.value = estado.topico_id;

  const fm = document.getElementById('f-materia');
  materias.forEach((m) => fm.append(el('option', { value: m.id, textContent: m.nome })));
}

async function listar() {
  const p = new URLSearchParams();
  const materia = document.getElementById('f-materia').value;
  const de = document.getElementById('f-de').value;
  const ate = document.getElementById('f-ate').value;
  if (materia) p.set('materia_id', materia);
  if (de) p.set('de', de);
  if (ate) p.set('ate', ate);

  const d = await pegar('/api/sessoes/?' + p.toString());
  document.getElementById('total-sessoes').textContent = d.sessoes.length
    ? `${plural(d.sessoes.length, 'sessão', 'sessões')} · ${minutosParaTexto(d.total_min)} no total`
    : '';

  const alvo = document.getElementById('historico');
  alvo.replaceChildren();

  if (!d.sessoes.length) {
    alvo.append(vazio('Nenhuma sessão neste filtro.', true));
    return;
  }

  d.sessoes.forEach((s) => {
    const apagar = el('button', {
      type: 'button',
      className: 'botao botao-perigo botao-mini',
      title: 'Excluir sessão',
      'aria-label': 'Excluir sessão',
    });
    apagar.append(icone('lixo'));
    apagar.onclick = async () => {
      const ok = await confirmar('Excluir esta sessão?', {
        detalhe: `${s.materia} · ${s.topico} — ${minutosParaTexto(s.duracao_min)}.`,
        acao: 'Excluir',
        perigo: true,
      });
      if (!ok) return;
      try {
        await enviar(`/api/sessoes/${s.id}/excluir/`);
        avisar('Sessão excluída.', 'ok');
        listar();
      } catch (erro) {
        reclamar(erro);
      }
    };

    alvo.append(
      el('div', { className: 'item' }, [
        ponto(s.cor),
        el('div', { className: 'cresce' }, [
          el('span', { textContent: `${s.materia} · ${s.topico}` }),
          el('small', {
            textContent:
              s.inicio.replace('T', ' ') +
              (s.interrupcoes ? ` · ${plural(s.interrupcoes, 'interrupção', 'interrupções')}` : '') +
              (s.nota ? ' — ' + s.nota : ''),
          }),
        ]),
        el('strong', { className: 'etiqueta', textContent: minutosParaTexto(s.duracao_min) }),
        apagar,
      ])
    );
  });
}

document.getElementById('filtros').onsubmit = (e) => {
  e.preventDefault();
  listar().catch(reclamar);
};

/* Os controles mostram o cronometro que esta rodando, nao os padroes: depois de
   recarregar, dizer "Livre / 25" enquanto o pomodoro de 1 min conta e mentira. */
document.getElementById('modo').value = estado ? estado.modo : 'livre';
document.getElementById('min-foco').value = estado ? estado.foco : painel.dataset.foco;
document.getElementById('min-pausa').value = estado ? estado.pausa : painel.dataset.pausa;

/* Vindo do planner ou do "Continuar" do dashboard
   (/sessao/?topico_id=&minutos=&iniciar=1): já deixa o tópico escolhido e o
   foco do tamanho do bloco, e com `iniciar` o cronômetro já começa — é o que
   torna "abrir o app e estar estudando" um clique só. */
function aplicarAtalhoDoPlanner() {
  const parametros = new URLSearchParams(location.search);
  const topico = parametros.get('topico_id');
  const minutos = Number(parametros.get('minutos'));
  const comecar = parametros.get('iniciar') === '1';

  if (topico && !estado) {
    const sel = document.getElementById('topico');
    if ([...sel.options].some((o) => o.value === topico)) sel.value = topico;
  }
  if (minutos > 0 && !estado) {
    document.getElementById('modo').value = 'pomodoro';
    document.getElementById('min-foco').value = Math.min(minutos, 180);
  }
  if (topico || minutos) {
    // A URL já cumpriu o papel; some com ela para um F5 não repetir o atalho.
    history.replaceState(null, '', location.pathname);
  }

  // Só começa sozinho quando há tópico e nada rodando: nunca por cima de um
  // cronômetro em andamento, e nunca sem saber o que está sendo estudado.
  if (comecar && topico && !estado) document.getElementById('iniciar').click();
}

preencherSeletores()
  .then(() => {
    aplicarAtalhoDoPlanner();
    return listar();
  })
  .catch(reclamar);
if (estado && estado.rodando) ligarTique();
mostrarInterrupcoes();
desenhar();
