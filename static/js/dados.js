/* Tela Dados: exportar e importar o backup JSON.

   O "Conferir" so conta o que o arquivo tem; o "Importar" grava. Mesma dupla de
   botoes do import de .ics no planner. */

const SECOES = [
  ['materias', 'matéria', 'matérias'],
  ['topicos', 'tópico', 'tópicos'],
  ['cartoes', 'cartão', 'cartões'],
  ['materiais', 'link de material', 'links de material'],
  ['sessoes', 'sessão', 'sessões'],
  ['blocos', 'bloco', 'blocos'],
  ['avaliacoes', 'avaliação', 'avaliações'],
  ['revisoes', 'revisão', 'revisões'],
  ['respostas', 'resposta de revisão', 'respostas de revisão'],
];

const campoArquivo = document.getElementById('b-arquivo');
const seletorModo = document.getElementById('b-modo');
const botaoImportar = document.getElementById('b-importar');
const alvo = document.getElementById('b-resultado');

function tabela(cabecalhos, linhas) {
  return el('table', {}, [
    el('thead', {}, [el('tr', {}, cabecalhos.map((c) => el('th', { textContent: c })))]),
    el('tbody', {}, linhas),
  ]);
}

async function lerArquivo() {
  const arquivo = campoArquivo.files[0];
  if (!arquivo) throw new Error('Escolha um arquivo .json.');
  return arquivo.text();
}

async function enviarBackup(preview) {
  return enviar('/api/backup/importar/', {
    backup: await lerArquivo(),
    substituir: seletorModo.value === 'substituir',
    preview: preview ? 1 : 0,
  });
}

function mostrarConferencia(resumo) {
  alvo.replaceChildren(
    el('p', {
      className: 'ajuda',
      style: { marginTop: 'var(--e4)' },
      textContent: resumo.gerado_em
        ? `Backup gerado em ${dataBr(resumo.gerado_em.slice(0, 10))}.`
        : 'Backup sem data de geração.',
    }),
    tabela(
      ['O que', 'No arquivo'],
      SECOES.map(([chave, singular, plural_]) =>
        el('tr', { className: resumo[chave] ? '' : 'apagada' }, [
          el('td', { textContent: resumo[chave] === 1 ? singular : plural_ }),
          el('td', { className: 'num', textContent: String(resumo[chave]) }),
        ])
      )
    )
  );
}

function mostrarImportacao(resumo) {
  alvo.replaceChildren(
    el('p', {
      className: 'ajuda',
      style: { marginTop: 'var(--e4)' },
      textContent: resumo.substituiu
        ? 'O banco foi substituído pelo conteúdo do arquivo.'
        : 'O que já existia no banco foi mantido como estava.',
    }),
    tabela(
      ['O que', 'Criados', 'Já existiam'],
      SECOES.map(([chave, singular, plural_]) =>
        el('tr', { className: resumo.criados[chave] ? '' : 'apagada' }, [
          el('td', { textContent: resumo.criados[chave] === 1 ? singular : plural_ }),
          el('td', { className: 'num', textContent: String(resumo.criados[chave]) }),
          el('td', { className: 'num', textContent: String(resumo.existentes[chave]) }),
        ])
      )
    )
  );
}

document.getElementById('form-backup').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const resposta = await enviarBackup(true);
    mostrarConferencia(resposta.resumo);
    botaoImportar.disabled = false;
  } catch (erro) {
    botaoImportar.disabled = true;
    reclamar(erro);
  }
};

botaoImportar.onclick = async () => {
  const substituir = seletorModo.value === 'substituir';
  const ok = await confirmar(
    substituir ? 'Apagar tudo e substituir?' : 'Importar este backup?',
    {
      detalhe: substituir
        ? 'Matérias, tópicos, sessões, planner e revisões que estão no banco agora serão apagados. Não tem como desfazer — exporte um backup antes.'
        : 'Os registros do arquivo serão somados ao que já existe.',
      acao: substituir ? 'Apagar e importar' : 'Importar',
      perigo: substituir,
    }
  );
  if (!ok) return;

  botaoImportar.disabled = true;
  try {
    const resposta = await enviarBackup(false);
    mostrarImportacao(resposta.resumo);
    avisar('Backup importado.', 'ok');
    campoArquivo.value = '';
  } catch (erro) {
    reclamar(erro);
  }
};

// Trocar de arquivo invalida a conferencia anterior.
campoArquivo.onchange = () => {
  botaoImportar.disabled = true;
  alvo.replaceChildren();
};
