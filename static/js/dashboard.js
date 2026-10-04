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

/* "Continuar": a rotina mais repetida do dia em um clique.
   O backend escolhe o tópico (bloco do planner de agora, ou o último estudado)
   e o link já leva o foco pronto, com `iniciar=1` para o cronômetro começar. */
function desenharContinuar(c) {
  const secao = document.getElementById('continuar');
  secao.hidden = !c;
  if (!c) return;

  const alvo = document.getElementById('continuar-corpo');
  alvo.replaceChildren(
    el('div', { className: 'cresce' }, [
      el('span', { className: 'rotulo', textContent: 'Continuar' }),
      el('strong', { className: 'continuar-topico' }, [
        ponto(c.cor),
        el('span', { textContent: c.materia ? `${c.materia} · ${c.topico}` : c.topico }),
      ]),
      el('p', { className: 'ajuda', textContent: `${c.motivo} · foco de ${c.minutos} min` }),
    ]),
    el('a', {
      className: 'botao',
      href: `/sessao/?topico_id=${c.topico_id}&minutos=${c.minutos}&iniciar=1`,
      textContent: 'Estudar agora',
    })
  );
}

/* Carga futura: o que o SM-2 já marcou para os próximos dias.
   O histórico olha para trás; sem isto, a dívida das revisões só aparece no dia
   em que ela vence — e aí não há mais o que decidir.

   Duas faixas alinhadas: as barras em cima, as datas embaixo. O dia vazio é um
   traço na linha de base, não uma caixa vazia: 26 caixas vazias em 28 dias
   parecem defeito, não um mês tranquilo. */
function desenharCarga(d) {
  document.getElementById('n-carga').textContent = d.total;
  document.getElementById('carga-resumo').textContent = d.teto
    ? `pico de ${plural(d.pico, 'revisão', 'revisões')} num dia · teto de ${d.teto}/dia`
    : `pico de ${plural(d.pico, 'revisão', 'revisões')} num dia · sem teto`;

  // A escala cabe o pico e o teto: a linha do teto tem de aparecer na faixa.
  const escala = Math.max(d.pico, d.teto || 0, 1);

  const barras = el('div', { className: 'carga-barras' });
  const rotulos = el('div', { className: 'carga-rotulos' });

  // A linha do teto é a leitura toda: barra que a encosta é dia cheio.
  if (d.teto) {
    barras.append(
      el('div', {
        className: 'carga-teto',
        style: { bottom: (d.teto * 100) / escala + '%' },
        title: `teto de ${d.teto} por dia`,
      })
    );
  }

  d.dias.forEach((dia, i) => {
    const rotulo =
      `${dataBr(dia.data)} (${DIAS_CURTOS[dia.dia_semana]}): ` +
      plural(dia.revisoes, 'revisão', 'revisões') +
      (dia.provas.length ? ` · ${dia.provas.join(', ')}` : '');

    barras.append(
      el('div', {
        className:
          'carga-dia' +
          (dia.revisoes ? '' : ' carga-vazio') +
          (dia.cheio ? ' carga-cheio' : '') +
          (dia.provas.length ? ' carga-prova' : ''),
        style: { '--altura': (dia.revisoes * 100) / escala + '%' },
        title: rotulo,
        'aria-label': rotulo,
      })
    );

    // Uma data por semana; 28 letras seguidas não são régua, são ruído.
    const [, mes, numero] = dia.data.split('-');
    rotulos.append(
      el('span', {
        className: 'carga-rotulo',
        textContent: i % 7 === 0 ? `${numero}/${mes}` : '',
      })
    );
  });

  document.getElementById('carga').replaceChildren(barras, rotulos);
}

/* Colisão: a semana antes da prova não cabe na agenda. Dizer o excedente é o que
   transforma o aviso em decisão — antecipar doze, ou aumentar o teto. */
function desenharColisoes(alertas) {
  const alvo = document.getElementById('colisoes');
  alvo.replaceChildren();
  if (!alertas.length) return;

  alertas.forEach((a) => {
    alvo.append(
      el('div', { className: 'item' }, [
        ponto(a.cor),
        el('div', { className: 'cresce' }, [
          el('strong', { textContent: `${a.titulo} · ${a.materia}` }),
          el('p', {
            className: 'ajuda',
            textContent:
              `${plural(a.revisoes_na_semana, 'revisão', 'revisões')} na semana da prova, ` +
              `capacidade de ${a.capacidade}. Antecipe ${a.excedente} ou aumente o teto.`,
          }),
        ]),
        el('span', { className: 'etiqueta etiqueta-alerta', textContent: contagem(a) }),
      ])
    );
  });
}

async function carregar() {
  const [d, carga] = await Promise.all([pegar('/api/dashboard/'), pegar('/api/carga/')]);

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

  desenharContinuar(d.continuar);
  desenharCarga(carga);
  desenharColisoes(carga.alertas);
  desenharAvaliacoes(d.avaliacoes);
  desenharDominio(d.materias);
  desenharParadas(d.materias_paradas);
}

carregar().catch(reclamar);
