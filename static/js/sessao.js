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

// Dois bipes curtos em WebAudio: nenhum arquivo de som para baixar, e o
// navegador em segundo plano continua tocando.
function bipar() {
  try {
    const audio = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.22].forEach((atraso, i) => {
      const oscilador = audio.createOscillator();
      const volume = audio.createGain();
      oscilador.connect(volume);
      volume.connect(audio.destination);
      oscilador.frequency.value = i ? 760 : 560;
      const comeco = audio.currentTime + atraso;
      volume.gain.setValueAtTime(0.0001, comeco);
      volume.gain.exponentialRampToValueAtTime(0.25, comeco + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, comeco + 0.18);
      oscilador.start(comeco);
      oscilador.stop(comeco + 0.2);
    });
    setTimeout(() => audio.close(), 1200);
  } catch (e) { /* sem áudio: o aviso na tela continua valendo */ }
}

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

    const agendada = r.revisao_agendada ? ' Próxima revisão agendada.' : '';
    avisar(`Sessão de ${minutosParaTexto(minutos)} salva.${agendada}`, 'ok');
    listar();
  } catch (erro) {
    reclamar(erro);
  }
};

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

/* Vindo do planner (/sessao/?topico_id=&minutos=): já deixa o tópico escolhido
   e o foco do tamanho do bloco, para o estudo começar em um clique. */
function aplicarAtalhoDoPlanner() {
  const parametros = new URLSearchParams(location.search);
  const topico = parametros.get('topico_id');
  const minutos = Number(parametros.get('minutos'));

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
