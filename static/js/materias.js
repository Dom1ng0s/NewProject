/* Arvore de materias > assuntos > subtopicos.
   A estrutura vem dos <template> de materias.html; aqui so entram os dados. */

const STATUS = JSON.parse(document.getElementById('status-opcoes').textContent);
const MOLDE_ASSUNTO = document.getElementById('molde-assunto');
const MOLDE_RAMO = document.getElementById('molde-ramo');

// Quais ramos estao abertos. Sobrevive ao recarregar.
const abertos = new Set(lerAbertos());

function lerAbertos() {
  try {
    return JSON.parse(localStorage.getItem('ramos-abertos') || '[]');
  } catch (e) {
    return [];
  }
}

function guardarAbertos() {
  try {
    localStorage.setItem('ramos-abertos', JSON.stringify([...abertos]));
  } catch (e) { /* sem localStorage: vale so nesta visita */ }
}

function seletorStatus(topico) {
  const select = el('select', { className: 'status', 'aria-label': `Status de ${topico.nome}` });
  STATUS.forEach(([valor, rotulo]) => select.append(el('option', { value: valor, textContent: rotulo })));
  select.value = topico.status;

  select.onchange = async () => {
    try {
      const r = await enviar(`/api/topicos/${topico.id}/status/`, { status: select.value });
      if (r.revisoes_criadas) {
        avisar(`${topico.nome}: ${plural(r.revisoes_criadas, 'revisão agendada', 'revisões agendadas')}.`, 'ok');
      }
    } catch (erro) {
      select.value = topico.status;
      reclamar(erro);
    }
  };
  return select;
}

function botaoIcone(rotulo, nomeIcone, aoClicar, classe = 'botao-fantasma') {
  const botao = el('button', {
    type: 'button',
    className: `botao ${classe} botao-mini`,
    title: rotulo,
    'aria-label': rotulo,
    onclick: aoClicar,
  });
  botao.setAttribute('aria-label', rotulo);
  botao.append(icone(nomeIcone));
  return botao;
}

/* Cartões do tópico: a pergunta e a resposta que a revisão vai cobrar.
   Fica aqui, junto da árvore, porque é onde o conteúdo é organizado. */
async function abrirCartoes(topico) {
  const lista = el('div', {});
  const campoFrente = el('textarea', { rows: 2, placeholder: 'Pergunta' });
  const campoVerso = el('textarea', { rows: 2, placeholder: 'Resposta' });

  async function recarregar() {
    const { cartoes } = await pegar(`/api/cartoes/?topico_id=${topico.id}`);
    lista.replaceChildren(
      ...(cartoes.length
        ? cartoes.map((c) =>
            el('div', { className: 'cartao-linha' }, [
              el('strong', { textContent: c.frente }),
              el('span', { className: 'verso', textContent: c.verso }),
              el('div', { className: 'acoes' }, [
                el('button', {
                  type: 'button',
                  className: 'botao botao-fantasma botao-mini',
                  textContent: 'Editar',
                  onclick: () => {
                    campoFrente.value = c.frente;
                    campoVerso.value = c.verso;
                    emEdicao = c.id;
                    salvar.textContent = 'Salvar alteração';
                    campoFrente.focus();
                  },
                }),
                el('button', {
                  type: 'button',
                  className: 'botao botao-perigo botao-fantasma botao-mini',
                  textContent: 'Excluir',
                  onclick: async () => {
                    const ok = await confirmar('Excluir este cartão?', {
                      detalhe: c.frente,
                      acao: 'Excluir',
                      perigo: true,
                    });
                    if (!ok) return;
                    try {
                      await enviar(`/api/cartoes/${c.id}/excluir/`);
                      if (emEdicao === c.id) limpar();
                      await recarregar();
                    } catch (erro) {
                      reclamar(erro);
                    }
                  },
                }),
              ]),
            ])
          )
        : [vazio('Nenhum cartão neste tópico ainda.', true)])
    );
  }

  let emEdicao = null;
  const salvar = el('button', { type: 'submit', className: 'botao', textContent: 'Adicionar' });

  function limpar() {
    emEdicao = null;
    campoFrente.value = '';
    campoVerso.value = '';
    salvar.textContent = 'Adicionar';
  }

  const formulario = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const dados = { frente: campoFrente.value, verso: campoVerso.value };
      try {
        if (emEdicao) await enviar(`/api/cartoes/${emEdicao}/editar/`, dados);
        else await enviar('/api/cartoes/criar/', { ...dados, topico_id: topico.id });
        limpar();
        await recarregar();
      } catch (erro) {
        reclamar(erro);
      }
    },
  }, [
    el('h2', { textContent: `Cartões de "${topico.nome}"` }),
    el('p', { className: 'ajuda', textContent: 'Na revisão, a pergunta aparece sozinha; a resposta só depois.' }),
    lista,
    campoFrente,
    campoVerso,
    el('div', { className: 'dialogo-acoes' }, [
      el('button', {
        type: 'button',
        className: 'botao botao-discreto',
        textContent: 'Fechar',
        onclick: () => dialogo.close(),
      }),
      salvar,
    ]),
  ]);

  await recarregar();
  const dialogo = abrirDialogo([formulario], () => campoFrente.focus());
}

/* Notas e material do tópico: o resumo livre e de onde o assunto foi estudado
   (link ou arquivo). É o que faltava para o tópico guardar conteúdo, e não só
   um nome e um status. */
async function abrirNotas(topico) {
  const campoNotas = el('textarea', {
    rows: 6,
    value: topico.notas || '',
    placeholder: 'Resumo, fórmulas, o que ficou confuso…',
  });
  const lista = el('div', {});

  const campoTitulo = el('input', { type: 'text', placeholder: 'Título do material' });
  const campoUrl = el('input', { type: 'url', placeholder: 'https://…' });
  const campoArquivo = el('input', { type: 'file' });
  const campoPagina = el('input', { type: 'text', placeholder: 'Página, capítulo…' });

  async function recarregar() {
    const { materiais } = await pegar(`/api/materiais/?topico_id=${topico.id}`);
    lista.replaceChildren(
      ...(materiais.length
        ? materiais.map((m) =>
            el('div', { className: 'item' }, [
              icone(m.tipo === 'arquivo' ? 'folha' : 'info'),
              el('a', {
                className: 'cresce',
                href: m.endereco,
                target: '_blank',
                rel: 'noreferrer',
                textContent: m.titulo,
              }),
              m.nota ? el('small', { textContent: m.nota }) : null,
              el('button', {
                type: 'button',
                className: 'botao botao-perigo botao-fantasma botao-mini',
                textContent: 'Excluir',
                onclick: async () => {
                  const ok = await confirmar('Excluir este material?', {
                    detalhe: m.tipo === 'arquivo' ? 'O arquivo sai do disco também.' : m.titulo,
                    acao: 'Excluir',
                    perigo: true,
                  });
                  if (!ok) return;
                  try {
                    await enviar(`/api/materiais/${m.id}/excluir/`);
                    await recarregar();
                  } catch (erro) {
                    reclamar(erro);
                  }
                },
              }),
            ])
          )
        : [vazio('Nenhum link ou arquivo neste tópico.', true)])
    );
  }

  async function adicionarMaterial() {
    const arquivo = campoArquivo.files[0];
    try {
      if (arquivo) {
        // Arquivo vai como multipart; o resto da tela fala JSON.
        const dados = new FormData();
        dados.append('topico_id', topico.id);
        dados.append('titulo', campoTitulo.value);
        dados.append('nota', campoPagina.value);
        dados.append('arquivo', arquivo);
        const resposta = await fetch('/api/materiais/criar/', { method: 'POST', body: dados });
        const corpo = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(corpo.erro || 'Não consegui guardar o arquivo.');
      } else {
        await enviar('/api/materiais/criar/', {
          topico_id: topico.id,
          titulo: campoTitulo.value,
          url: campoUrl.value,
          nota: campoPagina.value,
        });
      }
      campoTitulo.value = '';
      campoUrl.value = '';
      campoArquivo.value = '';
      campoPagina.value = '';
      await recarregar();
      avisar('Material adicionado.', 'ok');
    } catch (erro) {
      reclamar(erro);
    }
  }

  const formulario = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      try {
        await enviar(`/api/topicos/${topico.id}/editar/`, { notas: campoNotas.value });
        topico.notas = campoNotas.value;
        dialogo.close();
        avisar('Notas salvas.', 'ok');
      } catch (erro) {
        reclamar(erro);
      }
    },
  }, [
    el('h2', { textContent: `Notas de "${topico.nome}"` }),
    campoNotas,

    el('h3', { className: 'busca-grupo', textContent: 'Material' }),
    lista,
    el('div', { className: 'campo-par' }, [
      el('label', { className: 'campo' }, [el('span', { textContent: 'Título' }), campoTitulo]),
      el('label', { className: 'campo' }, [el('span', { textContent: 'Página' }), campoPagina]),
    ]),
    el('label', { className: 'campo' }, [el('span', { textContent: 'Link' }), campoUrl]),
    el('label', { className: 'campo' }, [el('span', { textContent: 'ou arquivo' }), campoArquivo]),
    el('div', { className: 'dialogo-acoes' }, [
      el('button', {
        type: 'button',
        className: 'botao botao-discreto',
        textContent: 'Adicionar material',
        onclick: adicionarMaterial,
      }),
    ]),

    el('div', { className: 'dialogo-acoes dialogo-acoes-partidas' }, [
      el('span', { className: 'cresce' }),
      el('button', {
        type: 'button',
        className: 'botao botao-discreto',
        textContent: 'Fechar',
        onclick: () => dialogo.close(),
      }),
      el('button', { type: 'submit', className: 'botao', textContent: 'Salvar notas' }),
    ]),
  ]);

  await recarregar();
  const dialogo = abrirDialogo([formulario], () => campoNotas.focus());
}

function montarRamo(topico, nivel) {
  const no = MOLDE_RAMO.content.firstElementChild.cloneNode(true);
  const gatilho = no.querySelector('.gatilho');
  const rotulo = no.querySelector('.ramo-rotulo');
  const linha = no.querySelector('.ramo-linha');
  const acoes = no.querySelector('.ramo-acoes');
  const filhos = no.querySelector('.ramo-filhos');

  const temFilhos = topico.filhos.length > 0;
  const id = `ramo-${topico.id}`;
  gatilho.id = id;
  rotulo.htmlFor = id;
  no.querySelector('.nome').textContent = topico.nome;

  if (temFilhos) {
    rotulo.prepend(icone('pasta', 'icone icone-fechada'), icone('pasta-aberta', 'icone icone-aberta'));
    gatilho.checked = abertos.has(id);
    gatilho.onchange = () => {
      gatilho.checked ? abertos.add(id) : abertos.delete(id);
      guardarAbertos();
    };
  } else {
    // folha: nao tem o que abrir, entao o rotulo deixa de ser clicavel
    linha.classList.add('ramo-folha');
    rotulo.prepend(icone('folha', 'icone'));
    rotulo.removeAttribute('for');
    rotulo.style.cursor = 'default';
    gatilho.remove();
  }

  // o status fica fora de .ramo-acoes: e informacao, tem de estar sempre visivel
  linha.insertBefore(seletorStatus(topico), acoes);

  if (nivel < 3) {
    acoes.append(
      botaoIcone('Novo subtópico', 'mais', async () => {
        const nome = await perguntar('Novo subtópico', {
          detalhe: `Dentro de "${topico.nome}".`,
          dica: 'Nome do subtópico',
        });
        if (!nome) return;
        try {
          await enviar('/api/topicos/criar/', { nome, pai_id: topico.id });
          abertos.add(id);
          guardarAbertos();
          avisar(`"${nome}" adicionado.`, 'ok');
          carregar();
        } catch (erro) {
          reclamar(erro);
        }
      })
    );
  }

  acoes.append(
    botaoIcone('Notas e material', 'folha', () => abrirNotas(topico).catch(reclamar)),
    botaoIcone('Cartões', 'cartao', () => abrirCartoes(topico).catch(reclamar))
  );

  acoes.append(
    botaoIcone(
      'Excluir tópico',
      'lixo',
      async () => {
        const ok = await confirmar(`Excluir "${topico.nome}"?`, {
          detalhe: temFilhos
            ? 'Os subtópicos dentro dele também serão excluídos.'
            : 'Esta ação não pode ser desfeita.',
          acao: 'Excluir',
          perigo: true,
        });
        if (!ok) return;
        try {
          await enviar(`/api/topicos/${topico.id}/excluir/`);
          avisar(`"${topico.nome}" excluído.`, 'ok');
          carregar();
        } catch (erro) {
          reclamar(erro);
        }
      },
      'botao-perigo'
    )
  );

  topico.filhos.forEach((f) => filhos.append(montarRamo(f, nivel + 1)));
  return no;
}

function montarAssunto(materia) {
  const no = MOLDE_ASSUNTO.content.firstElementChild.cloneNode(true);
  no.style.setProperty('--assunto-cor', materia.cor);
  no.querySelector('.assunto-nome').textContent = materia.nome;
  no.querySelector('.assunto-meta').textContent = `meta ${materia.meta_horas_semanais}h / semana`;

  const cor = no.querySelector('input[type="color"]');
  cor.value = materia.cor;
  cor.onchange = async () => {
    try {
      await enviar(`/api/materias/${materia.id}/editar/`, { cor: cor.value });
      carregar();
    } catch (erro) {
      reclamar(erro);
    }
  };

  no.querySelector('[data-acao="novo-assunto"]').onclick = async () => {
    const nome = await perguntar('Novo assunto', {
      detalhe: `Dentro de "${materia.nome}".`,
      dica: 'Nome do assunto',
    });
    if (!nome) return;
    try {
      await enviar('/api/topicos/criar/', { nome, materia_id: materia.id });
      avisar(`"${nome}" adicionado.`, 'ok');
      carregar();
    } catch (erro) {
      reclamar(erro);
    }
  };

  no.querySelector('[data-acao="excluir-materia"]').onclick = async () => {
    const ok = await confirmar(`Excluir a matéria "${materia.nome}"?`, {
      detalhe: 'Todos os assuntos, subtópicos e revisões dela serão excluídos.',
      acao: 'Excluir matéria',
      perigo: true,
    });
    if (!ok) return;
    try {
      await enviar(`/api/materias/${materia.id}/excluir/`);
      avisar(`"${materia.nome}" excluída.`, 'ok');
      carregar();
    } catch (erro) {
      reclamar(erro);
    }
  };

  const lista = no.querySelector('.arvore > ul');
  if (materia.topicos.length) {
    materia.topicos.forEach((t) => lista.append(montarRamo(t, 2)));
  } else {
    no.querySelector('.assunto-corpo').replaceChildren(
      vazio('Nenhum assunto nesta matéria ainda.', true)
    );
  }

  return no;
}

async function carregar() {
  const { materias } = await pegar('/api/arvore/');
  const alvo = document.getElementById('assuntos');
  alvo.replaceChildren();

  if (!materias.length) {
    alvo.append(vazio('Comece adicionando uma matéria acima.'));
    return;
  }

  materias.forEach((m) => alvo.append(montarAssunto(m)));
}

document.getElementById('form-materia').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    await enviar('/api/materias/criar/', {
      nome: f.nome.value,
      cor: f.cor.value,
      meta_horas_semanais: f.meta_horas_semanais.value,
    });
    avisar(`"${f.nome.value}" adicionada.`, 'ok');
    f.reset();
    carregar();
  } catch (erro) {
    reclamar(erro);
  }
};

carregar().catch(reclamar);
