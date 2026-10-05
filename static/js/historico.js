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

/* Tópicos frágeis: o estado do tópico diz onde a escada está, não quantas vezes
   ela caiu. Isto sai do log de respostas, e é a lista que decide onde gastar a
   próxima hora. */
function desenharFrageis(frageis) {
  const alvo = document.getElementById('frageis');
  document.getElementById('n-frageis').textContent = frageis.length;
  alvo.replaceChildren();

  if (!frageis.length) {
    alvo.append(vazio('Nenhum tópico com erro recorrente no período.', true));
    return;
  }

  frageis.forEach((t) => {
    const detalhe =
      `${plural(t.erros, 'erro', 'erros')} em ${t.respostas} revisões · ` +
      `facilidade ${t.facilidade}` +
      (t.interrupcoes_media ? ` · ${t.interrupcoes_media} interrupções por sessão` : '');

    alvo.append(
      el('div', { className: 'item' }, [
        ponto(t.cor),
        el('div', { className: 'cresce' }, [
          el('span', { textContent: `${t.materia} · ${t.topico}` }),
          el('small', { textContent: detalhe }),
        ]),
        el('span', {
          className: 'etiqueta' + (t.taxa_erro >= 50 ? ' etiqueta-alerta' : ''),
          textContent: `${t.taxa_erro}% errado`,
        }),
      ])
    );
  });
}

/* O número que nenhuma outra ferramenta tem: quem erra mais estuda mais picado?
   Não prova causa — mas é a pergunta que o contador de interrupções existe para
   responder, e ela só aparece com os dois lados na mesma base. */
function desenharInterrupcoes(d) {
  const alvo = document.getElementById('interrupcoes-erro');
  if (d.com_erro === null || d.sem_erro === null) {
    alvo.textContent = '';
    return;
  }
  const diferenca = d.com_erro > d.sem_erro ? 'mais' : 'menos';
  alvo.textContent =
    `Os ${d.topicos_com_erro} tópicos que erraram foram estudados com ${d.com_erro} ` +
    `interrupções por sessão — ${diferenca} que os ${d.topicos_sem_erro} que não erraram ` +
    `(${d.sem_erro}).`;
}

async function carregar() {
  const d = await pegar('/api/historico/');

  document.getElementById('semanas').textContent = d.semanas_na_meta;
  document.getElementById('semanas-unidade').textContent =
    d.semanas_na_meta === 1 ? ' semana' : ' semanas';
  document.getElementById('semanas-detalhe').textContent = d.meta_horas_semanais
    ? `seguidas com ${d.meta_horas_semanais}h ou mais · recorde de ${d.maior_semanas_na_meta}`
    : 'defina uma meta semanal nas configurações';

  document.getElementById('sequencia').textContent = d.sequencia_atual;
  // A folga é o que mantém a sequência utilizável: uma semana de prova derruba
  // um dia, e uma contagem que morre por isso ninguém recomeça.
  document.getElementById('sequencia-detalhe').textContent = d.sequencia_atual
    ? d.folgas_por_semana
      ? `${
          d.folgas_restantes
            ? plural(d.folgas_restantes, 'folga', 'folgas')
            : 'nenhuma folga'
        } nesta semana`
      : 'sem folga: um dia perdido zera'
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

  desenharFrageis(d.frageis);
  desenharInterrupcoes(d.interrupcoes_e_erro);
  desenharMapa(d.mapa);
  desenharTendencia(d.semanas);
  desenharTopicos(d.topicos);

  // O mapa termina em hoje; é o fim dele que interessa.
  const rolagem = document.querySelector('.mapa-rolagem');
  rolagem.scrollLeft = rolagem.scrollWidth;
}

carregar().catch(reclamar);
