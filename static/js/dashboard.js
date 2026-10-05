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
    // `/agora/` em vez da URL montada aqui: quem decide é o servidor, e é a
    // mesma porta que o atalho da tela inicial abre. Um destino, uma regra.
    el('a', {
      className: 'botao',
      href: '/agora/',
      textContent: 'Estudar agora',
    })
  );
}

/* O anel do dia e a sequência: as duas contas que decidem se o app abre amanhã.

   O anel conta só o que cabe no teto, então fecha; a sequência é de semanas na
   meta, não de dias seguidos, porque o dia escorrega e a semana não. */
function desenharProgresso(d) {
  const p = d.progresso;
  document.getElementById('progresso').replaceChildren(
    anelProgresso(
      p.percentual,
      p.total ? `${p.feitas}/${p.total}` : '—',
      p.total ? `${p.feitas} de ${p.total} revisões de hoje` : 'nada marcado para hoje'
    ),
    el('div', { className: 'progresso-texto cresce' }, [
      el('span', {
        className: 'ajuda',
        textContent: p.zerada
          ? p.total
            ? 'fila de hoje zerada'
            : 'nada marcado para hoje'
          : `${plural(p.restantes, 'revisão', 'revisões')} para fechar o dia`,
      }),
      el('a', {
        className: 'botao botao-mini' + (p.zerada ? ' botao-discreto' : ''),
        href: p.zerada ? '/revisar/' : '/revisar/?iniciar=1',
        textContent: p.zerada ? 'Ver a fila' : 'Revisar agora',
      }),
    ])
  );
}

function desenharSequencia(s) {
  document.getElementById('n-semanas').textContent = s.semanas;
  document.getElementById('semanas-unidade').textContent =
    s.semanas === 1 ? ' semana' : ' semanas';

  const partes = [];
  if (s.dias) partes.push(plural(s.dias, 'dia seguido', 'dias seguidos'));
  if (s.maior_semanas > s.semanas) partes.push(`recorde de ${s.maior_semanas}`);
  // A folga é o que impede a sequência de morrer numa semana de prova; dizer
  // quantas restam é o que a torna utilizável sem medo.
  if (s.folgas) {
    partes.push(
      s.folgas_restantes
        ? `${plural(s.folgas_restantes, 'folga', 'folgas')} na semana`
        : 'sem folga esta semana'
    );
  }
  document.getElementById('sequencia-detalhe').textContent = partes.join(' · ');
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

/* A corrida: o que está em jogo hoje, dito antes de qualquer outro número.

   Esta faixa é a diferença entre informação passiva e um motivo para começar.
   `em_risco` vem do servidor e quer dizer uma coisa só: existe uma sequência em
   pé e o dia ainda não foi cumprido. Quem não tem corrida não vê faixa nenhuma
   — cobrar de quem está voltando é cobrar justamente do dia em que voltou.

   A formulação é metade do trabalho: "6 dias seguidos — 1 folga disponível"
   engaja; "você não estudou hoje" faz fechar a aba. O texto diz o que está em
   pé e o que basta para mantê-lo, nunca o que foi falhado. */
function desenharCorrida(s, progresso) {
  const secao = document.getElementById('corrida');
  // Nada em jogo: dia cumprido, ou nenhuma corrida para manter.
  secao.hidden = !s.em_risco;
  if (!s.em_risco) return;

  const detalhes = [];
  if (s.folgas) {
    detalhes.push(
      s.folgas_restantes
        ? `${plural(s.folgas_restantes, 'folga', 'folgas')} de sobra nesta semana`
        : 'sem folga nesta semana'
    );
  }
  if (s.semanas) detalhes.push(`${plural(s.semanas, 'semana', 'semanas')} na meta`);

  // O que basta para segurar o dia. Uma revisão conta como estudo? Não: a
  // sequência é de sessões, e dizer o que de fato a mantém é o mínimo.
  const basta = progresso.restantes
    ? `${plural(progresso.restantes, 'revisão', 'revisões')} na fila · uma sessão segura o dia`
    : 'uma sessão de qualquer tamanho segura o dia';

  document.getElementById('corrida-corpo').replaceChildren(
    el('div', { className: 'cresce' }, [
      el('strong', { className: 'corrida-numero' }, [
        el('span', { textContent: String(s.dias) }),
        el('span', {
          className: 'unidade',
          textContent: s.dias === 1 ? ' dia seguido' : ' dias seguidos',
        }),
      ]),
      el('p', { className: 'ajuda', textContent: detalhes.join(' · ') }),
      el('p', { className: 'ajuda', textContent: basta }),
    ]),
    el('a', { className: 'botao', href: '/agora/', textContent: 'Estudar agora' })
  );
}

/* O investimento acumulado: o passado inteiro, uma vez.

   É sunk cost honesto — nada aqui pede nada nem cobra nada, e o número cresce
   só quando a pessoa estuda. Fica no fim da tela de propósito: não decide nada
   hoje, e o que não decide nada hoje não disputa o topo. */
function desenharInvestimento(inv) {
  const secao = document.getElementById('investimento');
  secao.hidden = !inv || !inv.minutos;
  if (secao.hidden) return;

  document.getElementById('investimento-desde').textContent = inv.desde
    ? `desde ${dataBr(inv.desde)}`
    : '';

  const numeros = [
    [`${inv.horas}h`, 'estudadas'],
    [inv.dias, inv.dias === 1 ? 'dia de estudo' : 'dias de estudo'],
    [inv.revisoes, inv.revisoes === 1 ? 'revisão fechada' : 'revisões fechadas'],
    [inv.dominados, inv.dominados === 1 ? 'tópico dominado' : 'tópicos dominados'],
  ];

  document.getElementById('investimento-numeros').replaceChildren(
    ...numeros.map(([valor, rotulo]) =>
      el('div', { className: 'investimento-item' }, [
        el('strong', { textContent: String(valor) }),
        el('span', { className: 'ajuda', textContent: rotulo }),
      ])
    )
  );
}

/* A carta da manga na tela, não atrás de um botão.

   O botão existia e quase ninguém aperta um botão para começar: o custo de
   entrada é o que mata app de estudo, e aqui ele vira zero — a pergunta já está
   aberta quando a tela carrega, de um tópico já dominado, sem nota para dar e
   sem nada do SM-2 se movendo. Quem respondeu uma pergunta já está estudando; o
   botão no fim só dá nome ao que já aconteceu.

   Carrega por fora do `carregar()` principal: um sorteio que falha (nenhum
   tópico dominado tem cartão) não pode atrasar nem derrubar o dashboard. */
async function montarSurpresaInline() {
  const secao = document.getElementById('surpresa-inline');
  let d;
  try {
    d = await pegar('/api/cartoes/surpresa/');
  } catch (erro) {
    secao.hidden = true; // sem cartão em tópico dominado: a seção não existe
    return;
  }

  let revelado = false;
  const alvo = document.getElementById('surpresa-corpo');

  function desenhar() {
    const acoes = [];
    if (!revelado) {
      acoes.push(
        el('button', {
          type: 'button',
          className: 'botao botao-mini',
          textContent: 'Mostrar resposta',
          onclick: () => {
            revelado = true;
            desenhar();
          },
        })
      );
    } else {
      acoes.push(
        el('button', {
          type: 'button',
          className: 'botao botao-fantasma botao-mini',
          textContent: 'Outro',
          onclick: () => montarSurpresaInline(),
        }),
        el('a', {
          className: 'botao botao-mini',
          href: `/sessao/?topico_id=${d.topico_id}&minutos=${d.minutos}&iniciar=1`,
          textContent: 'Estudar este tópico',
        })
      );
    }

    // `replaceChildren` não pula nulo como o `el()` pula: ele escreveria a
    // palavra "null" na tela. O verso só existe depois de revelado.
    alvo.replaceChildren(
      ...[
        el('p', { className: 'surpresa-rotulo' }, [
          ponto(d.cor),
          el('span', { textContent: `${d.materia} · ${d.topico}` }),
          el('span', { className: 'ajuda', textContent: 'sem nota, nada muda de lugar' }),
        ]),
        el('p', { className: 'cartao-frente', textContent: d.cartao.frente }),
        revelado ? el('p', { className: 'cartao-verso', textContent: d.cartao.verso }) : null,
        el('div', { className: 'surpresa-acoes' }, acoes),
      ].filter(Boolean)
    );
  }

  desenhar();
  secao.hidden = false;
}

async function carregar() {
  const [d, carga] = await Promise.all([pegar('/api/dashboard/'), pegar('/api/carga/')]);

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

  desenharProgresso(d);
  desenharSequencia(d.sequencia);
  desenharCorrida(d.sequencia, d.progresso);
  desenharContinuar(d.continuar);
  desenharInvestimento(d.investimento);
  desenharCarga(carga);
  desenharColisoes(carga.alertas);
  desenharAvaliacoes(d.avaliacoes);
  desenharDominio(d.materias);
  desenharParadas(d.materias_paradas);
}

/* A carta inline e os marcos correm por fora da carga principal: nenhum dos
   dois pode atrasar a tela, e a tecla `s` continua abrindo o diálogo em
   qualquer lugar do app. */
montarSurpresaInline();

carregar()
  // Os marcos só são pedidos depois de a tela estar montada: o POST é o que
  // grava "já falei disso", então pedir e não mostrar engoliria o parabéns.
  .then(conferirMarcos)
  .catch(reclamar);
