/* Configurações: os ajustes que antes só mudavam editando settings.py. */

const formulario = document.getElementById('form-config');

function preencher(config) {
  Object.entries(config).forEach(([nome, valor]) => {
    const campo = formulario.elements[nome];
    if (!campo) return;
    // A caixa de marcar não tem `value` para receber: tem `checked`.
    if (campo.type === 'checkbox') campo.checked = Boolean(valor);
    else campo.value = valor;
  });
  mostrarEstadoDaNotificacao();
}

function lerFormulario() {
  const dados = {};
  [...formulario.elements].forEach((campo) => {
    if (!campo.name) return;
    dados[campo.name] = campo.type === 'checkbox' ? campo.checked : campo.value;
  });
  return dados;
}

/* O app pode ter o lembrete ligado e o navegador ter negado a notificação — e
   aí o aviso só aparece dentro da tela. Dizer isso aqui é a diferença entre um
   lembrete que a pessoa acha quebrado e um que ela entende. */
function mostrarEstadoDaNotificacao() {
  const alvo = document.getElementById('estado-notificacao');
  const botao = document.getElementById('permitir-notificacao');
  if (!('Notification' in window)) {
    alvo.textContent = 'Este navegador não tem notificação do sistema; o lembrete aparece dentro do app.';
    botao.hidden = true;
    return;
  }
  const estados = {
    granted: 'Notificação permitida — o lembrete sai no sistema.',
    denied: 'Notificação negada no navegador; o lembrete aparece só dentro do app.',
    default: 'Notificação ainda não autorizada; o lembrete aparece só dentro do app.',
  };
  alvo.textContent = estados[Notification.permission] || '';
  botao.hidden = Notification.permission !== 'default';
}

/* A permissão só pode ser pedida a partir de um clique — é por isso que existe
   um botão, e não um pedido no carregamento da tela. */
document.getElementById('permitir-notificacao').onclick = async () => {
  try {
    await Notification.requestPermission();
  } catch (e) { /* negada: o estado abaixo já conta isso */ }
  mostrarEstadoDaNotificacao();
};

/* Ver o lembrete de hoje sem esperar a hora. Sem isto, conferir se funciona
   custa um dia de espera — e ninguém confia no que não pôde ver. */
document.getElementById('testar-lembrete').onclick = async () => {
  try {
    const d = await pegar('/api/lembrete/');
    if (!d.texto) {
      avisar('Hoje não há o que lembrar: o dia já está cumprido.', 'info');
      return;
    }
    avisar(`${d.texto} — sairia às ${d.hora}${d.automatico ? ' (hora automática)' : ''}.`, 'info');
  } catch (erro) {
    reclamar(erro);
  }
};

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
