function preencherLista(id, itens, texto, textoVazio) {
  const alvo = document.getElementById(id);
  alvo.replaceChildren();
  if (!itens.length) {
    alvo.append(el('li', { className: 'ajuda', textContent: textoVazio }));
    return;
  }
  itens.slice(0, 8).forEach((i) => alvo.append(el('li', { textContent: texto(i) })));
}

// Contagem regressiva em palavras; o numero sozinho nao diz se ja passou.
function contagem(a) {
  if (a.dias === 0) return 'hoje';
  if (a.dias === 1) return 'amanhã';
  if (a.dias > 0) return `em ${plural(a.dias, 'dia', 'dias')}`;
  return a.dias === -1 ? 'ontem' : `há ${plural(-a.dias, 'dia', 'dias')}`;
}

function desenharAvaliacoes(avaliacoes) {
  const alvo = document.getElementById('avaliacoes');
  document.getElementById('n-avaliacoes').textContent = avaliacoes.length;
  alvo.replaceChildren();

  if (!avaliacoes.length) {
    alvo.append(vazio('Nenhuma prova ou entrega nos próximos 30 dias.', true));
    return;
  }

  avaliacoes.forEach((a) => {
    alvo.append(
      el('div', { className: 'item' }, [
        ponto(a.cor),
        el('div', { className: 'cresce' }, [
          el('strong', { textContent: a.titulo }),
          el('p', {
            className: 'ajuda',
            textContent: `${a.materia} · ${dataBr(a.data)}${a.hora ? ' às ' + a.hora : ''}`,
          }),
        ]),
        el('span', {
          className: 'etiqueta' + (a.dias <= 3 ? ' etiqueta-alerta' : ''),
          textContent: contagem(a),
        }),
      ])
    );
  });
}

function desenharDominio(materias) {
  const alvo = document.getElementById('dominio');
  alvo.replaceChildren();

  if (!materias.length) {
    alvo.append(vazio('Cadastre uma matéria para ver o progresso.'));
    return;
  }

  materias.forEach((m) => {
    const preenchido = el('div', {
      className: 'medidor-preenchido',
      style: { width: m.percentual + '%', background: m.cor },
    });

    alvo.append(
      el('div', { className: 'linha-dominio' }, [
        el('div', { className: 'rotulo' }, [
          el('span', { textContent: m.nome }),
          el('span', {
            className: 'valor',
            textContent: `${m.percentual}% · ${m.dominados}/${m.total} · ${m.horas_semana}h`,
          }),
        ]),
        el('div', { className: 'medidor' }, [preenchido]),
      ])
    );
  });
}

// Usado na fila de revisao, onde o texto ja e longo: so o essencial.
function prazo(dias) {
  if (dias === 0) return 'hoje';
  if (dias < 0) return 'passou';
  return `em ${dias}d`;
}

function desenharParadas(paradas) {
  const alvo = document.getElementById('paradas');
  alvo.replaceChildren();

  if (!paradas.length) {
    alvo.append(vazio('Nenhuma matéria parada.', true));
    return;
  }

  paradas.forEach((m) => {
    alvo.append(
      el('div', { className: 'item' }, [
        el('span', { className: 'cresce', textContent: m.nome }),
        el('span', {
          className: 'etiqueta etiqueta-alerta',
          textContent: m.dias === null ? 'nunca estudada' : `${m.dias} dias`,
        }),
      ])
    );
  });
}

async function carregar() {
  const d = await pegar('/api/dashboard/');

  document.getElementById('n-hoje').textContent = d.revisoes_hoje.length;
  document.getElementById('n-atrasadas').textContent = d.revisoes_atrasadas.length;
  document.getElementById('horas-semana').textContent = d.horas_semana;
  document.getElementById('meta-semana').textContent = d.meta_horas_semanais;
  document.getElementById('medidor-meta').style.width = d.percentual_meta + '%';

  const comProva = (r) =>
    `${r.materia} · ${r.topico}` + (r.prova_dias === null ? '' : ` · prova ${prazo(r.prova_dias)}`);

  preencherLista('lista-hoje', d.revisoes_hoje, comProva, 'Nada para revisar hoje.');
  preencherLista(
    'lista-atrasadas',
    d.revisoes_atrasadas,
    (r) => `${comProva(r)} (${dataBr(r.data_prevista)})`,
    'Nenhuma atrasada.'
  );

  desenharAvaliacoes(d.avaliacoes);
  desenharDominio(d.materias);
  desenharParadas(d.materias_paradas);
}

carregar().catch(reclamar);
