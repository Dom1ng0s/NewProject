/* Tela Provas e prazos: cadastro, contagem regressiva e o conteúdo que cai. */

let avaliacoes = [];
let materias = [];

// Contagem regressiva em palavras. O numero sozinho ("3") nao diz se ja passou.
function contagem(a) {
  if (a.dias === 0) return 'hoje';
  if (a.dias === 1) return 'amanhã';
  if (a.dias > 0) return `em ${plural(a.dias, 'dia', 'dias')}`;
  return a.dias === -1 ? 'ontem' : `há ${plural(-a.dias, 'dia', 'dias')}`;
}

// Quanto mais perto, mais forte o aviso.
function classeDaEtiqueta(a) {
  if (a.concluida) return 'etiqueta';
  if (a.dias <= 3) return 'etiqueta etiqueta-alerta';
  return 'etiqueta';
}

function linha(a) {
  const detalhe = [
    a.materia,
    a.hora ? `${dataBr(a.data)} às ${a.hora}` : dataBr(a.data),
    a.peso ? `peso ${a.peso}` : '',
    a.nota !== null && a.nota !== undefined ? `nota ${a.nota}` : '',
    a.topicos.length ? plural(a.topicos.length, 'tópico', 'tópicos') : 'sem conteúdo marcado',
  ].filter(Boolean);

  return el('div', { className: 'item' + (a.concluida ? ' apagada' : ''), dataset: { id: a.id } }, [
    ponto(a.cor),
    el('div', { className: 'cresce' }, [
      el('strong', { textContent: a.titulo }),
      el('p', { className: 'ajuda', textContent: detalhe.join(' · ') }),
    ]),
    el('span', { className: classeDaEtiqueta(a), textContent: a.concluida ? 'concluída' : contagem(a) }),
    el('button', {
      type: 'button',
      className: 'botao botao-discreto botao-mini',
      textContent: 'Editar',
      onclick: () => abrirEdicao(a),
    }),
  ]);
}

function desenhar() {
  const abertas = avaliacoes.filter((a) => !a.concluida);
  const concluidas = avaliacoes.filter((a) => a.concluida);

  document.getElementById('n-abertas').textContent = abertas.length;

  const alvoAbertas = document.getElementById('abertas');
  alvoAbertas.replaceChildren(
    ...(abertas.length ? abertas.map(linha) : [vazio('Nenhuma prova ou entrega marcada.', true)])
  );

  const alvoConcluidas = document.getElementById('concluidas');
  alvoConcluidas.replaceChildren(
    ...(concluidas.length
      ? concluidas.map(linha)
      : [vazio('Marque "já aconteceu" quando a prova passar.', true)])
  );
}

function opcoesDeMateria(seletor, selecionada) {
  seletor.replaceChildren(
    ...materias.map((m) =>
      el('option', { value: String(m.id), textContent: m.nome, selected: m.id === selecionada })
    )
  );
}

// ---------------------------------------------------------------- edicao

async function abrirEdicao(a) {
  const molde = document.getElementById('molde-form-avaliacao');
  const formulario = molde.content.firstElementChild.cloneNode(true);
  const c = formulario.elements;

  c.titulo.value = a.titulo;
  opcoesDeMateria(c.materia_id, a.materia_id);
  c.tipo.value = a.tipo;
  c.data.value = a.data;
  c.hora.value = a.hora;
  c.peso.value = a.peso || '';
  c.nota.value = a.nota === null || a.nota === undefined ? '' : a.nota;
  c.descricao.value = a.descricao;
  c.concluida.checked = a.concluida;

  const caixaTopicos = formulario.querySelector('[data-campo="topicos"]');
  const aviso = formulario.querySelector('[data-campo="aviso-topicos"]');

  // O conteudo que cai so pode sair da materia da avaliacao; trocar de materia
  // recarrega a lista e descarta o que estava marcado.
  async function carregarTopicos(materiaId, marcados) {
    const { topicos } = await pegar(`/api/topicos/?materia_id=${materiaId}`);
    if (!topicos.length) {
      caixaTopicos.replaceChildren(vazio('Esta matéria ainda não tem tópicos.', true));
      aviso.textContent = '';
      return;
    }
    caixaTopicos.replaceChildren(
      ...topicos.map((t) =>
        el('label', { className: 'conteudo-topico' }, [
          el('input', {
            type: 'checkbox',
            value: String(t.id),
            checked: marcados.includes(t.id),
          }),
          el('span', { textContent: t.caminho }),
        ])
      )
    );
    aviso.textContent = 'O que estiver marcado entra na frente da fila de revisão.';
  }

  await carregarTopicos(a.materia_id, a.topicos.map((t) => t.id));
  c.materia_id.onchange = () => carregarTopicos(Number(c.materia_id.value), []).catch(reclamar);

  const dialogo = abrirDialogo([formulario], () => c.titulo.focus());

  formulario.querySelector('[data-acao="cancelar"]').onclick = () => dialogo.close();

  formulario.querySelector('[data-acao="excluir"]').onclick = async () => {
    const ok = await confirmar('Excluir esta avaliação?', {
      detalhe: `"${a.titulo}" sai da lista. Os tópicos ligados a ela continuam.`,
      acao: 'Excluir',
      perigo: true,
    });
    if (!ok) return;
    try {
      await enviar(`/api/avaliacoes/${a.id}/excluir/`);
      dialogo.close();
      avisar('Avaliação excluída.', 'ok');
      await carregar();
    } catch (erro) {
      reclamar(erro);
    }
  };

  formulario.onsubmit = async (e) => {
    e.preventDefault();
    const marcados = [...caixaTopicos.querySelectorAll('input:checked')].map((i) => Number(i.value));
    try {
      await enviar(`/api/avaliacoes/${a.id}/editar/`, {
        titulo: c.titulo.value,
        materia_id: c.materia_id.value,
        tipo: c.tipo.value,
        data: c.data.value,
        hora: c.hora.value,
        peso: c.peso.value,
        nota: c.nota.value,
        descricao: c.descricao.value,
        concluida: c.concluida.checked,
        topico_ids: marcados,
      });
      dialogo.close();
      avisar('Avaliação atualizada.', 'ok');
      await carregar();
    } catch (erro) {
      reclamar(erro);
    }
  };
}

// ---------------------------------------------------------------- carga

async function carregar() {
  const dados = await pegar('/api/avaliacoes/?todas=1');
  avaliacoes = dados.avaliacoes;
  desenhar();
}

document.getElementById('form-avaliacao').onsubmit = async (e) => {
  e.preventDefault();
  const formulario = e.target;
  const c = formulario.elements;
  try {
    await enviar('/api/avaliacoes/criar/', {
      titulo: c.titulo.value,
      materia_id: c.materia_id.value,
      tipo: c.tipo.value,
      data: c.data.value,
    });
    formulario.reset();
    avisar('Avaliação criada.', 'ok');
    await carregar();
  } catch (erro) {
    reclamar(erro);
  }
};

pegar('/api/materias/')
  .then((dados) => {
    materias = dados.materias;
    opcoesDeMateria(document.querySelector('#form-avaliacao [name="materia_id"]'));
    return carregar();
  })
  .catch(reclamar);
