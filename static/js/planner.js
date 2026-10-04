let semana = null;
const ALTURA_HORA = 44; // px por hora na grade

// Listas usadas tanto no formulario de criar quanto no painel de editar.
let MATERIAS = [];
let TOPICOS = [];
const MOLDE_PAINEL = document.getElementById('molde-painel-bloco');

const seletorDia = document.getElementById('b-dia');
DIAS.forEach((d, i) => seletorDia.append(el('option', { value: i, textContent: d })));
seletorDia.value = Math.min(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1, 6);

async function preencherSeletores() {
  const [{ materias }, { topicos }] = await Promise.all([
    pegar('/api/materias/'),
    pegar('/api/topicos/'),
  ]);
  MATERIAS = materias;
  TOPICOS = topicos;

  const sm = document.getElementById('b-materia');
  sm.replaceChildren(el('option', { value: '', textContent: 'Sem matéria' }));
  materias.forEach((m) => sm.append(el('option', { value: m.id, textContent: m.nome })));

  const im = document.getElementById('i-materia');
  materias.forEach((m) => im.append(el('option', { value: m.id, textContent: m.nome })));

  const st = document.getElementById('b-topico');
  st.replaceChildren(el('option', { value: '', textContent: 'Sem tópico' }));
  topicos.forEach((t) =>
    st.append(el('option', { value: t.id, textContent: `${t.materia} · ${t.caminho}` }))
  );
}

// Reparte em colunas os blocos que se sobrepoem no mesmo dia.
function repartir(blocos) {
  const grupos = [];
  blocos
    .slice()
    .sort((a, b) => a.inicio_min - b.inicio_min)
    .forEach((bloco) => {
      const fim = bloco.inicio_min + bloco.duracao_min;
      const grupo = grupos.find((g) =>
        g.some((o) => bloco.inicio_min < o.inicio_min + o.duracao_min && o.inicio_min < fim)
      );
      grupo ? grupo.push(bloco) : grupos.push([bloco]);
    });

  const posicoes = new Map();
  grupos.forEach((grupo) => {
    grupo.forEach((bloco, i) => posicoes.set(bloco, { coluna: i, de: grupo.length }));
  });
  return posicoes;
}

function botaoBloco(rotulo, texto, aoClicar) {
  const botao = el('button', {
    type: 'button',
    className: 'botao botao-fantasma',
    textContent: texto,
    title: rotulo,
    'aria-label': rotulo,
  });
  botao.onclick = aoClicar;
  return botao;
}

function cartaoBloco(bloco, posicao) {
  const caixa = el('div', {
    className: `bloco bloco-${bloco.tipo}`,
    title:
      `${bloco.hora_inicio}–${bloco.hora_fim} · ${bloco.rotulo}` +
      (bloco.descricao ? `
${bloco.descricao}` : ''),
    style: {
      '--bloco-cor': bloco.cor,
      top: ((bloco.inicio_min - semana.hora_min * 60) / 60) * ALTURA_HORA + 'px',
      height: Math.max((bloco.duracao_min / 60) * ALTURA_HORA - 2, 18) + 'px',
      left: (posicao.coluna / posicao.de) * 100 + '%',
      width: (1 / posicao.de) * 100 + '%',
    },
  });
  if (bloco.pulado) caixa.classList.add('bloco-pulado');

  // o bloco inteiro abre o painel de edicao; os botoes de canto param o clique
  caixa.tabIndex = 0;
  caixa.setAttribute('role', 'button');
  caixa.onclick = () => abrirPainelBloco(bloco);
  caixa.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      abrirPainelBloco(bloco);
    }
  };

  const acoes = el('div', { className: 'bloco-acoes' });

  if (bloco.recorrente) {
    acoes.append(
      botaoBloco(
        bloco.pulado ? 'Voltar nesta semana' : 'Pular nesta semana',
        bloco.pulado ? '↺' : '–',
        async (e) => {
          e.stopPropagation();
          try {
            await enviar(`/api/blocos/${bloco.id}/pular/`, { semana: semana.semana });
            carregar(semana.semana);
          } catch (erro) {
            reclamar(erro);
          }
        }
      )
    );
  }

  acoes.append(
    botaoBloco(bloco.recorrente ? 'Excluir de todas as semanas' : 'Excluir bloco', '×', async (e) => {
      e.stopPropagation();
      if (bloco.recorrente) {
        const ok = await confirmar(`Excluir "${bloco.rotulo}"?`, {
          detalhe: 'O bloco sai de todas as semanas, não só desta.',
          acao: 'Excluir de todas',
          perigo: true,
        });
        if (!ok) return;
      }
      try {
        await enviar(`/api/blocos/${bloco.id}/excluir/`);
        avisar(`"${bloco.rotulo}" excluído.`, 'ok');
        carregar(semana.semana);
      } catch (erro) {
        reclamar(erro);
      }
    })
  );

  caixa.append(
    acoes,
    el('span', { className: 'titulo', textContent: bloco.rotulo }),
    el('span', {
      className: 'hora',
      textContent: `${bloco.hora_inicio}–${bloco.hora_fim}` + (bloco.recorrente ? ' · semanal' : ''),
    })
  );
  if (bloco.topico) caixa.append(el('span', { className: 'hora', textContent: bloco.topico }));
  return caixa;
}

function desenharGrade() {
  const grade = document.getElementById('grade');
  const horas = semana.hora_max - semana.hora_min;
  const altura = horas * ALTURA_HORA;
  grade.replaceChildren();

  const regua = el('div', { className: 'regua' }, [el('div', { className: 'regua-topo' })]);
  for (let h = semana.hora_min; h < semana.hora_max; h++) {
    regua.append(
      el('div', { className: 'regua-hora', textContent: String(h).padStart(2, '0') + ':00' })
    );
  }
  grade.append(regua);

  const hoje = new Date();
  const diaHoje = hoje.getDay() === 0 ? 6 : hoje.getDay() - 1;

  DIAS.forEach((nome, i) => {
    const doDia = semana.blocos.filter((b) => b.dia_semana === i);
    const posicoes = repartir(doDia);

    const pista = el('div', { className: 'pista', style: { height: altura + 'px' } });
    for (let h = 0; h < horas; h++) {
      pista.append(el('div', { className: 'risco', style: { top: h * ALTURA_HORA + 'px' } }));
    }
    doDia.forEach((b) => pista.append(cartaoBloco(b, posicoes.get(b))));

    const coluna = el('div', { className: 'dia' }, [
      el('div', { className: 'dia-topo', textContent: DIAS_CURTOS[i], title: nome }),
      pista,
    ]);
    if (semana.e_semana_atual && i === diaHoje) coluna.classList.add('dia-hoje');
    grade.append(coluna);
  });
}

function tabela(cabecalhos, linhas) {
  return el('table', {}, [
    el('thead', {}, [el('tr', {}, cabecalhos.map((c) => el('th', { textContent: c })))]),
    el('tbody', {}, linhas),
  ]);
}

function desenharComparativo() {
  const alvo = document.getElementById('comparativo');
  alvo.replaceChildren();

  if (!semana.comparativo.length) {
    alvo.append(vazio('Sem blocos nem sessões nesta semana.', true));
    return;
  }

  const linhas = semana.comparativo.map((c) =>
    el('tr', {}, [
      el('td', {}, [ponto(c.cor), document.createTextNode(' ' + c.materia)]),
      el('td', { className: 'num', textContent: c.planejado_h + ' h' }),
      el('td', { className: 'num', textContent: c.realizado_h + ' h' }),
      el('td', { className: 'num', textContent: c.meta_h + ' h' }),
    ])
  );

  alvo.append(tabela(['Matéria', 'Planejado', 'Realizado', 'Meta'], linhas));
}

async function carregar(alvoSemana) {
  semana = await pegar('/api/planner/?semana=' + (alvoSemana || ''));
  document.getElementById('rotulo-semana').textContent =
    'Semana de ' + dataBr(semana.semana) + (semana.e_semana_atual ? ' · atual' : '');
  desenharGrade();
  desenharComparativo();
}

document.getElementById('semana-anterior').onclick = () => carregar(semana.semana_anterior).catch(reclamar);
document.getElementById('semana-seguinte').onclick = () => carregar(semana.semana_seguinte).catch(reclamar);
document.getElementById('semana-atual').onclick = () => carregar('').catch(reclamar);

// Escolher um topico implica a materia dele.
document.getElementById('b-topico').onchange = (e) => {
  if (e.target.value) document.getElementById('b-materia').value = '';
};

document.getElementById('form-bloco').onsubmit = async (e) => {
  e.preventDefault();
  const titulo = document.getElementById('b-titulo');
  try {
    await enviar('/api/blocos/criar/', {
      tipo: document.getElementById('b-tipo').value,
      titulo: titulo.value,
      semana: semana.semana,
      recorrente: document.getElementById('b-recorrente').checked,
      dia_semana: document.getElementById('b-dia').value,
      hora_inicio: document.getElementById('b-inicio').value,
      hora_fim: document.getElementById('b-fim').value,
      materia_id: document.getElementById('b-materia').value,
      topico_id: document.getElementById('b-topico').value,
    });
    avisar('Bloco adicionado.', 'ok');
    titulo.value = '';
    carregar(semana.semana);
  } catch (erro) {
    reclamar(erro);
  }
};

// ---------------------------------------------------------------- editar bloco

function opcoes(select, itens, textoVazio) {
  select.replaceChildren(el('option', { value: '', textContent: textoVazio }));
  itens.forEach((i) => select.append(el('option', { value: i.id, textContent: i.texto })));
}

function abrirPainelBloco(bloco) {
  const form = MOLDE_PAINEL.content.firstElementChild.cloneNode(true);
  const c = form.elements;

  opcoes(c.materia_id, MATERIAS.map((m) => ({ id: m.id, texto: m.nome })), 'Sem matéria');
  opcoes(
    c.topico_id,
    TOPICOS.map((t) => ({ id: t.id, texto: `${t.materia} · ${t.caminho}` })),
    'Sem tópico'
  );
  DIAS.forEach((d, i) => c.dia_semana.append(el('option', { value: i, textContent: d })));

  c.titulo.value = bloco.titulo || '';
  c.descricao.value = bloco.descricao || '';
  c.tipo.value = bloco.tipo;
  c.recorrente.value = bloco.recorrente ? '1' : '';
  c.materia_id.value = bloco.materia_id || '';
  c.topico_id.value = bloco.topico_id || '';
  c.dia_semana.value = bloco.dia_semana;
  c.hora_inicio.value = bloco.hora_inicio;
  c.hora_fim.value = bloco.hora_fim;

  form.querySelector('[data-campo="resumo"]').textContent = bloco.rotulo;

  // A duracao nao se digita: ela sai do inicio e do fim, e muda junto.
  const duracao = form.querySelector('[data-campo="duracao"]');
  const emMinutos = (hhmm) => {
    const [h, m] = (hhmm || '0:0').split(':').map(Number);
    return h * 60 + m;
  };
  const mostrarDuracao = () => {
    const min = emMinutos(c.hora_fim.value) - emMinutos(c.hora_inicio.value);
    duracao.textContent =
      min > 0 ? `Duração: ${minutosParaTexto(min)}.` : 'O fim precisa ser depois do início.';
  };
  c.hora_inicio.onchange = mostrarDuracao;
  c.hora_fim.onchange = mostrarDuracao;
  mostrarDuracao();

  // Escolher um topico implica a materia dele, como no formulario de criar.
  c.topico_id.onchange = () => {
    if (c.topico_id.value) c.materia_id.value = '';
  };

  const dialogo = abrirDialogo([form], () => c.titulo.focus());

  form.querySelector('[data-acao="cancelar"]').onclick = () => dialogo.close();

  /* Do planejado para o feito em um clique: leva o topico e a duracao do bloco
     para o cronometro, em vez de obrigar a reescolher tudo na mao. */
  const estudar = form.querySelector('[data-acao="estudar"]');
  if (bloco.topico_id) {
    estudar.onclick = () => {
      location.href = `/sessao/?topico_id=${bloco.topico_id}&minutos=${bloco.duracao_min}`;
    };
  } else {
    estudar.disabled = true;
    estudar.title = 'Escolha um tópico no bloco para estudar a partir dele.';
  }

  form.querySelector('[data-acao="excluir"]').onclick = async () => {
    const ok = await confirmar(`Excluir "${bloco.rotulo}"?`, {
      detalhe: bloco.recorrente
        ? 'O bloco sai de todas as semanas, não só desta.'
        : 'Esta ação não pode ser desfeita.',
      acao: 'Excluir',
      perigo: true,
    });
    if (!ok) return;
    try {
      await enviar(`/api/blocos/${bloco.id}/excluir/`);
      dialogo.close();
      avisar(`"${bloco.rotulo}" excluído.`, 'ok');
      carregar(semana.semana);
    } catch (erro) {
      reclamar(erro);
    }
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await enviar(`/api/blocos/${bloco.id}/editar/`, {
        tipo: c.tipo.value,
        titulo: c.titulo.value,
        descricao: c.descricao.value,
        recorrente: !!c.recorrente.value,
        semana: semana.semana,
        dia_semana: c.dia_semana.value,
        hora_inicio: c.hora_inicio.value,
        hora_fim: c.hora_fim.value,
        materia_id: c.materia_id.value,
        topico_id: c.topico_id.value,
      });
      dialogo.close();
      avisar('Bloco atualizado.', 'ok');
      carregar(semana.semana);
    } catch (erro) {
      reclamar(erro);
    }
  };
}

// ---------------------------------------------------------------- importar .ics

async function enviarIcs(preview) {
  const arquivo = document.getElementById('i-arquivo').files[0];
  if (!arquivo) throw new Error('Escolha um arquivo .ics.');

  const dados = new FormData();
  dados.append('arquivo', arquivo);
  dados.append('tipo', document.getElementById('i-tipo').value);
  dados.append('materia_id', document.getElementById('i-materia').value);
  if (preview) dados.append('preview', '1');

  const resposta = await fetch('/api/planner/importar-ical/', { method: 'POST', body: dados });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.erro || 'Não consegui ler o arquivo.');
  return corpo;
}

function mostrarIcs(resposta) {
  const alvo = document.getElementById('i-resultado');
  const r = resposta.resumo;

  alvo.replaceChildren(
    el('p', {
      className: 'ajuda',
      style: { marginTop: 'var(--e4)' },
      textContent: r.preview
        ? `${r.novos} a importar · ${r.existentes} já no planner · ` +
          plural(r.ignorados, 'ignorado', 'ignorados')
        : `${plural(r.criados, 'bloco criado', 'blocos criados')} · ` +
          `${r.existentes} já ${r.existentes === 1 ? 'existia' : 'existiam'} · ` +
          plural(r.ignorados, 'ignorado', 'ignorados'),
    })
  );

  if (!resposta.itens.length) {
    alvo.append(vazio('Nenhum evento neste arquivo.', true));
    return;
  }

  const situacoes = { novo: 'importar', existe: 'já existe', ignorado: 'ignorado' };
  const linhas = resposta.itens.map((i) =>
    el('tr', { className: i.situacao === 'novo' ? '' : 'apagada' }, [
      el('td', { textContent: i.titulo }),
      el('td', { textContent: i.ignorado ? '—' : DIAS[i.dia_semana] }),
      el('td', { className: 'num', textContent: i.ignorado ? '—' : `${i.hora_inicio}–${i.hora_fim}` }),
      el('td', { textContent: i.ignorado ? '' : i.recorrente ? 'toda semana' : dataBr(i.data) }),
      el('td', { textContent: i.materia || '' }),
      el('td', { textContent: i.ignorado || situacoes[i.situacao] }),
    ])
  );

  alvo.append(tabela(['Evento', 'Dia', 'Horário', 'Quando', 'Matéria', 'Situação'], linhas));
}

document.getElementById('form-ical').onsubmit = async (e) => {
  e.preventDefault();
  const botao = document.getElementById('i-importar');
  try {
    const resposta = await enviarIcs(true);
    mostrarIcs(resposta);
    botao.disabled = resposta.resumo.novos === 0;
    if (resposta.resumo.novos === 0) avisar('Nada novo para importar neste arquivo.', 'info');
  } catch (erro) {
    botao.disabled = true;
    reclamar(erro);
  }
};

document.getElementById('i-importar').onclick = async (e) => {
  try {
    const resposta = await enviarIcs(false);
    mostrarIcs(resposta);
    e.target.disabled = true;
    avisar(`${plural(resposta.resumo.criados, 'bloco importado', 'blocos importados')}.`, 'ok');
    carregar(semana.semana);
  } catch (erro) {
    reclamar(erro);
  }
};

// Trocar o arquivo invalida a conferencia anterior.
document.getElementById('i-arquivo').onchange = () => {
  document.getElementById('i-importar').disabled = true;
  document.getElementById('i-resultado').replaceChildren();
};

preencherSeletores()
  .then(() => carregar(''))
  .catch(reclamar);
