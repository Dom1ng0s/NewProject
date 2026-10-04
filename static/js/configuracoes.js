/* Configurações: os ajustes que antes só mudavam editando settings.py. */

const formulario = document.getElementById('form-config');

function preencher(config) {
  Object.entries(config).forEach(([nome, valor]) => {
    const campo = formulario.elements[nome];
    if (campo) campo.value = valor;
  });
}

function lerFormulario() {
  const dados = {};
  [...formulario.elements].forEach((campo) => {
    if (campo.name) dados[campo.name] = campo.value;
  });
  return dados;
}

async function carregar() {
  const { configuracao } = await pegar('/api/configuracoes/');
  preencher(configuracao);
}

formulario.onsubmit = async (e) => {
  e.preventDefault();
  try {
    const resposta = await enviar('/api/configuracoes/salvar/', lerFormulario());
    preencher(resposta.configuracao);
    avisar('Configurações salvas.', 'ok');
  } catch (erro) {
    reclamar(erro);
  }
};

document.getElementById('restaurar').onclick = async () => {
  const ok = await confirmar('Voltar tudo ao padrão?', {
    detalhe: 'Os ajustes voltam aos valores de fábrica. Seus estudos não são tocados.',
    acao: 'Restaurar',
  });
  if (!ok) return;
  try {
    const resposta = await enviar('/api/configuracoes/salvar/', { restaurar: true });
    preencher(resposta.configuracao);
    avisar('Configurações restauradas.', 'ok');
  } catch (erro) {
    reclamar(erro);
  }
};

carregar().catch(reclamar);
