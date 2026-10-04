/* Histórico: mapa de constância, tendência por semana e onde o tempo foi.

   O mapa é uma grade de 7 linhas (segunda a domingo) por semana, como o de
   contribuições do GitHub: cada quadrado é um dia, a cor é o quanto rendeu. */

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function rotuloDoDia(d) {
  const [a, m, dia] = d.data.split('-');
  const quando = `${dia}/${m}/${a}`;
  return d.minutos ? `${quando}: ${minutosParaTexto(d.minutos)}` : `${quando}: sem estudo`;
}

function desenharMapa(mapa) {
  const alvo = document.getElementById('mapa');
  alvo.replaceChildren();

  // Uma coluna por semana; o dia da semana define a linha.
  let coluna = null;
  let mesAnterior = null;

  mapa.forEach((d) => {
    if (d.dia_semana === 0 || coluna === null) {
      coluna = el('div', { className: 'mapa-coluna' });
      const mes = Number(d.data.slice(5, 7)) - 1;
      // O nome do mês só aparece quando o mês vira, para a régua não poluir.
      coluna.append(
        el('span', {
          className: 'mapa-mes',
          textContent: mes !== mesAnterior ? MES_CURTO[mes] : '',
        })
      );
      mesAnterior = mes;
      alvo.append(coluna);

      // Semana que começa no meio do período: empurra o primeiro dia para baixo.
      for (let i = 0; i < d.dia_semana; i += 1) {
        coluna.append(el('span', { className: 'mapa-dia mapa-vazio' }));
      }
    }

    coluna.append(
      el('span', {
        className: `mapa-dia nivel-${d.nivel}`,
        title: rotuloDoDia(d),
        'aria-label': rotuloDoDia(d),
      })
    );
  });
}

function desenharTendencia(semanas) {
  const alvo = document.getElementById('tendencia');
  alvo.replaceChildren();

  const teto = Math.max(...semanas.map((s) => s.minutos), 1);

  semanas.forEach((s) => {
    const [, mes, dia] = s.semana.split('-');
    alvo.append(
      el('div', { className: 'linha-dominio' }, [
        el('div', { className: 'rotulo' }, [
          el('span', { textContent: `${dia}/${mes}` }),
          el('span', {
            className: 'valor',
            textContent: `${s.horas}h · ${plural(s.revisoes, 'revisão', 'revisões')}`,
          }),
        ]),
        el('div', { className: 'medidor' }, [
          el('div', {
            className: 'medidor-preenchido',
            style: { width: `${Math.round((s.minutos * 100) / teto)}%` },
          }),
        ]),
      ])
    );
  });
}

function desenharTopicos(topicos) {
  const alvo = document.getElementById('topicos');
  alvo.replaceChildren();

  if (!topicos.length) {
    alvo.append(vazio('Nenhuma sessão registrada no período.', true));
    return;
  }

  topicos.forEach((t) => {
    alvo.append(
      el('div', { className: 'item' }, [
        ponto(t.cor),
        el('div', { className: 'cresce' }, [
          el('span', { textContent: t.topico }),
          el('small', { textContent: t.materia }),
        ]),
        el('span', { className: 'etiqueta', textContent: `${t.horas}h` }),
      ])
    );
  });
}

async function carregar() {
  const d = await pegar('/api/historico/');

  document.getElementById('sequencia').textContent = d.sequencia_atual;
  document.getElementById('sequencia-detalhe').textContent = d.sequencia_atual
    ? 'seguidos com pelo menos uma sessão'
    : 'estude hoje para começar de novo';

  document.getElementById('dias-ativos').textContent = d.dias_ativos;
  document.getElementById('dias-periodo').textContent = ` / ${d.dias_no_periodo}`;
  document.getElementById('media-dia').textContent = d.media_por_dia_ativo
    ? `${d.media_por_dia_ativo}h em média por dia estudado`
    : 'sem sessões no período';

  document.getElementById('total-horas').textContent = d.total_horas;
  document.getElementById('maior-sequencia').textContent = `maior sequência: ${plural(
    d.maior_sequencia,
    'dia',
    'dias'
  )}`;

  desenharMapa(d.mapa);
  desenharTendencia(d.semanas);
  desenharTopicos(d.topicos);

  // O mapa termina em hoje; é o fim dele que interessa.
  const rolagem = document.querySelector('.mapa-rolagem');
  rolagem.scrollLeft = rolagem.scrollWidth;
}

carregar().catch(reclamar);
