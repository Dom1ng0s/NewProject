const COLUNAS = JSON.parse(document.getElementById('status-opcoes').textContent);
const quadro = document.getElementById('quadro');
const filtroMateria = document.getElementById('f-materia');
const soFolhas = document.getElementById('so-folhas');

let topicos = [];

function lembrado(chave, padrao = '') {
  try {
    return localStorage.getItem(chave) ?? padrao;
  } catch (e) {
    return padrao;
  }
}

function lembrar(chave, valor) {
  try {
    localStorage.setItem(chave, valor);
  } catch (e) { /* sem localStorage: o filtro vale so nesta visita */ }
}

soFolhas.checked = lembrado('quadro-folhas') === '1';

async function mover(id, status) {
  const topico = topicos.find((t) => String(t.id) === String(id));
  if (!topico || topico.status === status) return;

  const anterior = topico.status;
  topico.status = status; // pinta na hora; volta atras se o servidor recusar
  desenhar();

  try {
    const r = await enviar(`/api/topicos/${id}/status/`, { status });
    // Booleano, não contagem: há no máximo uma revisão pendente por tópico.
    if (r.revisao_agendada) avisar(`${topico.nome}: próxima revisão agendada.`, 'ok');
  } catch (erro) {
    topico.status = anterior;
    desenhar();
    reclamar(erro);
  }
}

function ficha(topico, indiceColuna) {
  const caixa = el('div', {
    className: 'ficha',
    draggable: true,
    dataset: { id: topico.id },
    style: { '--ficha-cor': topico.cor },
  });

  caixa.ondragstart = (e) => {
    e.dataTransfer.setData('text/plain', String(topico.id));
    caixa.classList.add('arrastando');
  };
  caixa.ondragend = () => caixa.classList.remove('arrastando');

  const setas = el('div', { className: 'setas' });
  [-1, 1].forEach((passo) => {
    const destino = indiceColuna + passo;
    const existe = destino >= 0 && destino < COLUNAS.length;
    const botao = el('button', {
      type: 'button',
      className: 'botao botao-fantasma',
      textContent: passo < 0 ? '‹' : '›',
      disabled: !existe,
      title: existe ? `Mover para ${COLUNAS[destino][1]}` : '',
      'aria-label': existe ? `Mover ${topico.nome} para ${COLUNAS[destino][1]}` : 'Sem coluna',
    });
    if (existe) botao.onclick = () => mover(topico.id, COLUNAS[destino][0]);
    setas.append(botao);
  });

  caixa.append(
    el('div', { className: 'ficha-topo' }, [
      el('span', { className: 'ficha-nome', textContent: topico.nome }),
      setas,
    ]),
    el('small', { className: 'ficha-caminho', textContent: topico.caminho_pai || topico.materia })
  );
  return caixa;
}

function desenhar() {
  const materia = filtroMateria.value;
  const visiveis = topicos.filter(
    (t) => (!materia || String(t.materia_id) === materia) && (!soFolhas.checked || t.folha)
  );

  quadro.replaceChildren();

  COLUNAS.forEach(([valor, rotulo], indice) => {
    const daColuna = visiveis.filter((t) => t.status === valor);
    const corpo = el('div', { className: 'coluna-corpo' });

    daColuna.forEach((t) => corpo.append(ficha(t, indice)));
    if (!daColuna.length) corpo.append(vazio('Solte uma ficha aqui.', true));

    const caixa = el('div', { className: 'coluna' }, [
      el('h2', { className: 'coluna-topo' }, [
        el('span', { textContent: rotulo }),
        el('span', { className: 'etiqueta conta', textContent: daColuna.length }),
      ]),
      corpo,
    ]);

    caixa.ondragover = (e) => {
      e.preventDefault();
      caixa.classList.add('alvo');
    };
    caixa.ondragleave = () => caixa.classList.remove('alvo');
    caixa.ondrop = (e) => {
      e.preventDefault();
      caixa.classList.remove('alvo');
      mover(e.dataTransfer.getData('text/plain'), valor);
    };

    quadro.append(caixa);
  });
}

async function carregar() {
  const [dadosTopicos, { materias }] = await Promise.all([
    pegar('/api/topicos/'),
    pegar('/api/materias/'),
  ]);

  const pais = new Set(dadosTopicos.topicos.map((t) => t.pai_id).filter(Boolean));
  topicos = dadosTopicos.topicos.map((t) => ({
    ...t,
    folha: !pais.has(t.id),
    // caminho sem o proprio nome, para a ficha nao repetir o titulo
    caminho_pai: [t.materia, ...t.caminho.split(' / ').slice(0, -1)].join(' · '),
  }));

  filtroMateria.replaceChildren(el('option', { value: '', textContent: 'Todas as matérias' }));
  materias.forEach((m) => filtroMateria.append(el('option', { value: m.id, textContent: m.nome })));
  filtroMateria.value = lembrado('quadro-materia');

  desenhar();
}

filtroMateria.onchange = () => {
  lembrar('quadro-materia', filtroMateria.value);
  desenhar();
};

soFolhas.onchange = () => {
  lembrar('quadro-folhas', soFolhas.checked ? '1' : '0');
  desenhar();
};

carregar().catch(reclamar);
