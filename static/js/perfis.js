/* "Quem está estudando?": a porta do app.

   O padrão é o da TV da sala — uma grade de rostos, um clique, pronto. O que
   ele resolve aqui não é estética: sem dono, duas pessoas na mesma máquina (ou
   a mesma pessoa separando faculdade de concurso) disputam uma lista de
   matérias só, e a fila de revisão de uma vira ruído para a outra.

   Entrar é um clique. Tudo o que é administração (renomear, trocar a foto,
   excluir) mora atrás de "Gerenciar perfis", porque é feito uma vez por ano e
   não pode disputar espaço com o que é feito todo dia. */

const CORES = JSON.parse(document.getElementById('cores').textContent);
const grade = document.getElementById('perfis-grade');
const titulo = document.getElementById('perfis-titulo');
const ajuda = document.getElementById('perfis-ajuda');
const botaoGerenciar = document.getElementById('gerenciar');

let perfis = JSON.parse(document.getElementById('perfis-iniciais').textContent);
let gerenciando = false;

// ----------------------------------------------------------------- avatar

/* Sem foto, a inicial sobre a cor do perfil. Não é um "foto faltando": é um
   avatar legítimo, e é o que permite criar um perfil sem parar para procurar
   uma imagem — a foto fica para quando der vontade. */
function avatar(p, tamanho) {
  const caixa = el('div', {
    className: 'avatar' + (tamanho ? ' avatar-' + tamanho : ''),
    style: { background: p.cor },
  });

  if (p.foto) {
    caixa.append(el('img', { src: p.foto, alt: '', loading: 'lazy' }));
  } else {
    caixa.append(el('span', { className: 'avatar-inicial', textContent: p.inicial }));
  }
  return caixa;
}

function inicialDe(texto) {
  const limpo = (texto || '').trim();
  return limpo ? limpo[0].toUpperCase() : '?';
}

// ----------------------------------------------------------------- entrar

async function entrar(p) {
  try {
    await enviar('/api/perfis/' + p.id + '/entrar/');
    // Volta para onde a pessoa queria ir; sem isso, escolher o perfil custaria
    // um segundo clique para chegar na tela que ela pediu.
    const destino = new URLSearchParams(location.search).get('proximo');
    location.href = destino && destino.startsWith('/') ? destino : '/';
  } catch (erro) {
    reclamar(erro);
  }
}

// ----------------------------------------------------------------- formulário

/* Um diálogo só, para criar e para editar: os campos são os mesmos, e duas
   telas quase iguais seriam duas telas para manter desalinhadas. */
function abrirFormulario(p) {
  const criando = !p;
  const atual = p || { nome: '', cor: CORES[0], inicial: '?', foto: '' };
  let foto = null;
  let removerFoto = false;
  let cor = atual.cor;

  const previa = avatar(atual, 'g');
  const nome = el('input', {
    type: 'text',
    value: atual.nome,
    maxLength: 40,
    placeholder: 'Nome do perfil',
    'aria-label': 'Nome do perfil',
  });

  function mostrarInicial() {
    previa.style.background = cor;
    previa.replaceChildren(
      el('span', { className: 'avatar-inicial', textContent: inicialDe(nome.value) })
    );
  }

  function repintar() {
    previa.style.background = cor;
    const inicial = previa.querySelector('.avatar-inicial');
    if (inicial) inicial.textContent = inicialDe(nome.value);
  }

  const paleta = el('div', { className: 'paleta' });
  CORES.forEach((c) => {
    const botao = el('button', {
      type: 'button',
      className: 'paleta-cor' + (c === cor ? ' escolhida' : ''),
      style: { background: c },
      'aria-label': 'Cor ' + c,
      onclick: () => {
        cor = c;
        [...paleta.children].forEach((b) => b.classList.remove('escolhida'));
        botao.classList.add('escolhida');
        repintar();
      },
    });
    paleta.append(botao);
  });

  nome.oninput = repintar;

  const campoFoto = el('input', {
    type: 'file',
    accept: 'image/png,image/jpeg,image/gif,image/webp',
    id: 'campo-foto',
  });
  campoFoto.onchange = () => {
    foto = campoFoto.files[0] || null;
    if (!foto) return;
    removerFoto = false;
    // Prévia local: ver a foto antes de enviar evita o perfil nascer com a
    // imagem errada e só se descobrir depois.
    previa.replaceChildren(el('img', { src: URL.createObjectURL(foto), alt: '' }));
  };

  const tirarFoto = el('button', {
    type: 'button',
    className: 'botao botao-fantasma botao-mini',
    textContent: 'Usar a inicial',
    onclick: () => {
      foto = null;
      removerFoto = true;
      campoFoto.value = '';
      mostrarInicial();
    },
  });

  const salvar = el('button', {
    type: 'button',
    className: 'botao',
    textContent: criando ? 'Criar perfil' : 'Salvar',
  });

  salvar.onclick = async () => {
    const dados = new FormData();
    dados.append('nome', nome.value);
    dados.append('cor', cor);
    if (foto) dados.append('foto', foto);
    if (removerFoto) dados.append('remover_foto', '1');

    salvar.disabled = true;
    try {
      const url = criando ? '/api/perfis/criar/' : '/api/perfis/' + p.id + '/editar/';
      await enviarArquivo(url, dados);
      dialogo.close();
      avisar(criando ? 'Perfil criado.' : 'Perfil salvo.', 'ok');
      await recarregar();
    } catch (erro) {
      salvar.disabled = false;
      reclamar(erro);
    }
  };

  const dialogo = abrirDialogo(
    [
      el('h2', { textContent: criando ? 'Novo perfil' : 'Editar perfil' }),
      el('div', { className: 'formulario-perfil' }, [
        previa,
        el('div', { className: 'cresce' }, [
          nome,
          paleta,
          el('div', { className: 'linha-foto' }, [
            el('label', {
              className: 'botao botao-discreto botao-mini',
              htmlFor: 'campo-foto',
              textContent: 'Escolher foto',
            }),
            campoFoto,
            tirarFoto,
          ]),
        ]),
      ]),
      el('div', { className: 'dialogo-acoes' }, [
        el('button', {
          type: 'button',
          className: 'botao botao-discreto',
          textContent: 'Cancelar',
          onclick: () => dialogo.close(),
        }),
        salvar,
      ]),
    ],
    () => nome.focus()
  );
}

// ----------------------------------------------------------------- excluir

/* Excluir perfil parece apagar um nome e apaga um semestre. O aviso diz o
   tamanho antes, em números do próprio perfil — é a diferença entre um
   "tem certeza?" decorativo e uma decisão informada. */
async function excluir(p) {
  let resumo = null;
  try {
    resumo = await pegar('/api/perfis/' + p.id + '/resumo/');
  } catch (erro) {
    resumo = null;
  }

  const partes = resumo
    ? [
        plural(resumo.materias, 'matéria', 'matérias'),
        plural(resumo.topicos, 'tópico', 'tópicos'),
        plural(resumo.sessoes, 'sessão', 'sessões'),
        plural(resumo.revisoes, 'revisão feita', 'revisões feitas'),
      ]
    : [];

  const ok = await confirmar('Excluir o perfil "' + p.nome + '"?', {
    detalhe: partes.length
      ? 'Vão junto: ' + partes.join(', ') + '. Não dá para desfazer.'
      : 'Não dá para desfazer.',
    acao: 'Excluir perfil',
    perigo: true,
  });
  if (!ok) return;

  try {
    await enviar('/api/perfis/' + p.id + '/excluir/');
    avisar('Perfil "' + p.nome + '" excluído.', 'ok');
    await recarregar();
  } catch (erro) {
    reclamar(erro);
  }
}

// ----------------------------------------------------------------- grade

function cartaoDoPerfil(p) {
  const bloco = el('div', { className: 'perfil' });
  const alvo = el('button', {
    type: 'button',
    className: 'perfil-alvo',
    onclick: () => (gerenciando ? abrirFormulario(p) : entrar(p)),
  });
  alvo.append(avatar(p), el('span', { className: 'perfil-nome', textContent: p.nome }));
  bloco.append(alvo);

  if (gerenciando) {
    bloco.append(
      el('div', { className: 'perfil-acoes' }, [
        el('button', {
          type: 'button',
          className: 'botao botao-discreto botao-mini',
          textContent: 'Editar',
          onclick: () => abrirFormulario(p),
        }),
        el('button', {
          type: 'button',
          className: 'botao botao-perigo botao-mini',
          textContent: 'Excluir',
          onclick: () => excluir(p),
        }),
      ])
    );
  }
  return bloco;
}

function cartaoDeNovo() {
  const bloco = el('div', { className: 'perfil' });
  const alvo = el('button', {
    type: 'button',
    className: 'perfil-alvo',
    onclick: () => abrirFormulario(null),
  });
  const mais = el('div', { className: 'avatar avatar-novo' });
  mais.append(icone('mais'));
  alvo.append(mais, el('span', { className: 'perfil-nome', textContent: 'Novo perfil' }));
  bloco.append(alvo);
  return bloco;
}

function desenhar() {
  grade.replaceChildren(...perfis.map(cartaoDoPerfil), cartaoDeNovo());

  titulo.textContent = gerenciando
    ? 'Gerenciar perfis'
    : perfis.length
      ? 'Quem está estudando?'
      : 'Crie o primeiro perfil';
  ajuda.textContent = gerenciando
    ? 'Toque num perfil para renomear, trocar a cor ou a foto.'
    : 'Cada perfil tem as próprias matérias, revisões e metas.';
  botaoGerenciar.textContent = gerenciando ? 'Concluído' : 'Gerenciar perfis';
  botaoGerenciar.hidden = !perfis.length;
}

async function recarregar() {
  const d = await pegar('/api/perfis/');
  perfis = d.perfis;
  desenhar();
}

botaoGerenciar.onclick = () => {
  gerenciando = !gerenciando;
  desenhar();
};

desenhar();
// Sem nenhum perfil o app não tem porta de entrada: o formulário já abre.
if (!perfis.length) abrirFormulario(null);
