import { useEffect, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { Link } from 'react-router';
import {
  aplicarMudancas,
  problemasDeConfiguracoes,
  salvarConfiguracoes,
  useConfiguracoes,
} from '@/modulos/nucleo';
import type { CampoNumericoDeConfiguracoes, Configuracoes } from '@/modulos/nucleo';
import {
  formatarMinutosEmHoras,
  formatarReais,
  lerCentavosDeReais,
  lerHorasEmMinutos,
  lerInteiro,
} from '@/compartilhado';
import { Aviso, Campo, GrupoDeOpcoes, useTituloDaPagina } from '@/ui';
import { textos } from '@/i18n';
import estilos from './Configuracoes.module.css';

const textosDeConfiguracoes = textos.nucleo.configuracoes;

function formatarInteiro(valor: number): string {
  return String(valor);
}

interface CampoTextoConfig {
  readonly campo: CampoNumericoDeConfiguracoes;
  readonly formatar: (valor: number) => string;
  readonly ler: (texto: string) => number | null;
  readonly permiteVazioComoNulo: boolean;
  readonly mensagemDeFormato: string;
  readonly mensagemDeNegativo: string;
  readonly mensagemDeSucesso: (valor: number | null) => string;
  readonly construirMudanca: (valor: number | null) => Partial<Configuracoes>;
}

const CONFIG_CAMPO_FOCO: CampoTextoConfig = {
  campo: 'metaSemanalDeFocoEmMinutos',
  formatar: formatarMinutosEmHoras,
  ler: lerHorasEmMinutos,
  permiteVazioComoNulo: false,
  mensagemDeFormato: textosDeConfiguracoes.erros.formatoFoco,
  mensagemDeNegativo: textosDeConfiguracoes.erros.negativoFoco,
  mensagemDeSucesso: () => textosDeConfiguracoes.salvo.metaSemanalDeFocoEmMinutos,
  construirMudanca: (valor) => ({ metaSemanalDeFocoEmMinutos: valor! }),
};

const CONFIG_CAMPO_TREINOS: CampoTextoConfig = {
  campo: 'metaSemanalDeTreinos',
  formatar: formatarInteiro,
  ler: lerInteiro,
  permiteVazioComoNulo: false,
  mensagemDeFormato: textosDeConfiguracoes.erros.formatoTreinos,
  mensagemDeNegativo: textosDeConfiguracoes.erros.negativoTreinos,
  mensagemDeSucesso: () => textosDeConfiguracoes.salvo.metaSemanalDeTreinos,
  construirMudanca: (valor) => ({ metaSemanalDeTreinos: valor! }),
};

const CONFIG_CAMPO_ORCAMENTO: CampoTextoConfig = {
  campo: 'orcamentoMensalEmCentavos',
  formatar: formatarReais,
  ler: lerCentavosDeReais,
  permiteVazioComoNulo: true,
  mensagemDeFormato: textosDeConfiguracoes.erros.formatoOrcamento,
  mensagemDeNegativo: textosDeConfiguracoes.erros.negativoOrcamento,
  mensagemDeSucesso: (valor) =>
    valor === null
      ? textosDeConfiguracoes.salvo.orcamentoRemovido
      : textosDeConfiguracoes.salvo.orcamentoMensalEmCentavos,
  construirMudanca: (valor) => ({ orcamentoMensalEmCentavos: valor }),
};

interface CampoTextoEstado {
  readonly texto: string;
  readonly erro: string;
  readonly aoMudarTexto: (evento: ChangeEvent<HTMLInputElement>) => void;
  readonly aoFocar: () => void;
  readonly aoDesfocar: () => void;
  readonly aoTeclar: (evento: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Estado e confirmação (`blur`, `Enter`, `visibilitychange` oculto) de um
 * campo de texto numérico de configurações (ADR 0008, seção 3.5/3.6/4).
 * Enquanto o campo tem foco ou texto não confirmado, não é sobrescrito por
 * fora; fora disso, acompanha `useConfiguracoes()`.
 */
function useCampoDeTextoDeConfiguracao(
  config: CampoTextoConfig,
  configuracoes: Configuracoes,
  aoSalvarComSucesso: (mensagem: string) => void,
): CampoTextoEstado {
  const valorGravado = configuracoes[config.campo];
  const valorExibido = valorGravado === null ? '' : config.formatar(valorGravado);

  const [texto, setTexto] = useState(valorExibido);
  const [baseline, setBaseline] = useState(valorExibido);
  const [erro, setErro] = useState('');
  const [focado, setFocado] = useState(false);

  // Ajuste durante a renderização (padrão React de "adjusting state when a
  // prop changes", não um `useEffect`): compara com o valor gravado visto no
  // render anterior e, só então, decide se reescreve `texto`/`baseline`.
  // Enquanto o campo tem foco ou tem texto não confirmado (`texto !==
  // baseline`), a tela não o sobrescreve (ADR 0008, seção 3.6).
  const [ultimoValorExibido, setUltimoValorExibido] = useState(valorExibido);
  if (valorExibido !== ultimoValorExibido) {
    setUltimoValorExibido(valorExibido);
    if (!focado && texto === baseline) {
      setTexto(valorExibido);
      setBaseline(valorExibido);
      setErro('');
    }
  }

  async function confirmar(): Promise<void> {
    const textoAtual = texto;
    if (textoAtual === baseline) return; // nada mudou: não grava (critério 13)

    const vazio = textoAtual.trim() === '';
    if (vazio && !config.permiteVazioComoNulo) {
      setErro(config.mensagemDeFormato);
      return;
    }

    const valorLido = vazio ? null : config.ler(textoAtual);
    if (valorLido === null && !vazio) {
      setErro(config.mensagemDeFormato);
      return;
    }

    const candidato = aplicarMudancas(configuracoes, config.construirMudanca(valorLido));
    const problema = problemasDeConfiguracoes(candidato).find((p) => p.campo === config.campo);
    if (problema) {
      setErro(
        problema.codigo === 'negativo' ? config.mensagemDeNegativo : config.mensagemDeFormato,
      );
      return;
    }

    setErro('');
    try {
      await salvarConfiguracoes(config.construirMudanca(valorLido));
      const textoFinal = valorLido === null ? '' : config.formatar(valorLido);
      setTexto(textoFinal);
      setBaseline(textoFinal);
      aoSalvarComSucesso(config.mensagemDeSucesso(valorLido));
    } catch {
      setErro(textosDeConfiguracoes.erros.falhaAoSalvar);
    }
  }

  // Confirma ao a página ficar oculta (ADR 0008, seção 3.5) — cobre fechar o
  // app com o teclado aberto, quando `blur` sozinho não é confiável no
  // iPhone. `confirmar` é recriada a cada render (fecha sobre `texto`/
  // `baseline` atuais); o efeito reinscreve o listener a cada vez, o que é
  // barato e mantém sempre a versão mais recente sem precisar de refs.
  useEffect(() => {
    function aoMudarVisibilidade() {
      if (document.visibilityState === 'hidden') {
        void confirmar();
      }
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => document.removeEventListener('visibilitychange', aoMudarVisibilidade);
  });

  return {
    texto,
    erro,
    aoMudarTexto: (evento) => setTexto(evento.target.value),
    aoFocar: () => setFocado(true),
    aoDesfocar: () => {
      setFocado(false);
      void confirmar();
    },
    aoTeclar: (evento) => {
      if (evento.key === 'Enter') {
        evento.preventDefault();
        void confirmar();
      }
    },
  };
}

interface CampoOpcaoEstado<V extends string> {
  readonly valorExibido: V;
  readonly erro: string;
  readonly aoMudar: (valor: V) => void;
}

/** Atualização otimista de rádio (ADR 0008, seção 3.6): marca na hora, desfaz se `salvarConfiguracoes` rejeitar. */
function useCampoUnidadeDePeso(
  valorGravado: Configuracoes['unidadeDePeso'],
  aoSalvarComSucesso: (mensagem: string) => void,
): CampoOpcaoEstado<Configuracoes['unidadeDePeso']> {
  const [otimista, setOtimista] = useState<Configuracoes['unidadeDePeso'] | null>(null);
  const [erro, setErro] = useState('');

  // Ajuste durante a renderização: assim que o valor gravado alcança o que
  // foi mostrado de forma otimista, limpa o otimista (sem `useEffect`).
  if (otimista !== null && otimista === valorGravado) {
    setOtimista(null);
  }

  function aoMudar(valor: Configuracoes['unidadeDePeso']): void {
    setOtimista(valor);
    setErro('');
    void salvarConfiguracoes({ unidadeDePeso: valor })
      .then(() => {
        aoSalvarComSucesso(textosDeConfiguracoes.salvo.unidadeDePeso);
      })
      .catch(() => {
        setOtimista(valorGravado);
        setErro(textosDeConfiguracoes.erros.falhaAoSalvar);
      });
  }

  return { valorExibido: otimista ?? valorGravado, erro, aoMudar };
}

/** Mesmo padrão de `useCampoUnidadeDePeso`, para `tema`. */
function useCampoTema(
  valorGravado: Configuracoes['tema'],
  aoSalvarComSucesso: (mensagem: string) => void,
): CampoOpcaoEstado<Configuracoes['tema']> {
  const [otimista, setOtimista] = useState<Configuracoes['tema'] | null>(null);
  const [erro, setErro] = useState('');

  // Ajuste durante a renderização: assim que o valor gravado alcança o que
  // foi mostrado de forma otimista, limpa o otimista (sem `useEffect`).
  if (otimista !== null && otimista === valorGravado) {
    setOtimista(null);
  }

  function aoMudar(valor: Configuracoes['tema']): void {
    setOtimista(valor);
    setErro('');
    void salvarConfiguracoes({ tema: valor })
      .then(() => {
        aoSalvarComSucesso(textosDeConfiguracoes.salvo.tema);
      })
      .catch(() => {
        setOtimista(valorGravado);
        setErro(textosDeConfiguracoes.erros.falhaAoSalvar);
      });
  }

  return { valorExibido: otimista ?? valorGravado, erro, aoMudar };
}

/**
 * Tela `/configuracoes` (ADR 0008): metas semanais, orçamento, unidade de
 * peso e tema. Sem botão "Salvar" — cada campo grava sozinho ao ser
 * confirmado (texto) ou ao mudar (rádio). Sem props: lê e grava só pelas
 * interfaces públicas de `@/modulos/nucleo`.
 */
export function TelaDeConfiguracoes() {
  useTituloDaPagina(textos.comum.tituloDaPagina('Configurações'));
  const configuracoes = useConfiguracoes();
  const [mensagemDeStatus, setMensagemDeStatus] = useState('');

  const campoFoco = useCampoDeTextoDeConfiguracao(
    CONFIG_CAMPO_FOCO,
    configuracoes,
    setMensagemDeStatus,
  );
  const campoTreinos = useCampoDeTextoDeConfiguracao(
    CONFIG_CAMPO_TREINOS,
    configuracoes,
    setMensagemDeStatus,
  );
  const campoOrcamento = useCampoDeTextoDeConfiguracao(
    CONFIG_CAMPO_ORCAMENTO,
    configuracoes,
    setMensagemDeStatus,
  );
  const campoUnidadeDePeso = useCampoUnidadeDePeso(
    configuracoes.unidadeDePeso,
    setMensagemDeStatus,
  );
  const campoTema = useCampoTema(configuracoes.tema, setMensagemDeStatus);

  return (
    <main className={estilos['pagina']}>
      <h1>{textosDeConfiguracoes.titulo}</h1>
      <p className={estilos['introducao']}>{textosDeConfiguracoes.introducao}</p>
      <p className={estilos['status']} role="status" aria-live="polite">
        {mensagemDeStatus}
      </p>

      <section className={estilos['secao']}>
        <h2>{textosDeConfiguracoes.metas.titulo}</h2>
        <Campo
          rotulo={textosDeConfiguracoes.metas.rotuloFoco}
          dica={textosDeConfiguracoes.metas.dicaFoco}
          erro={campoFoco.erro}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          value={campoFoco.texto}
          onChange={campoFoco.aoMudarTexto}
          onFocus={campoFoco.aoFocar}
          onBlur={campoFoco.aoDesfocar}
          onKeyDown={campoFoco.aoTeclar}
        />
        <Campo
          rotulo={textosDeConfiguracoes.metas.rotuloTreinos}
          dica={textosDeConfiguracoes.metas.dicaTreinos}
          erro={campoTreinos.erro}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          value={campoTreinos.texto}
          onChange={campoTreinos.aoMudarTexto}
          onFocus={campoTreinos.aoFocar}
          onBlur={campoTreinos.aoDesfocar}
          onKeyDown={campoTreinos.aoTeclar}
        />
      </section>

      <section className={estilos['secao']}>
        <h2>{textosDeConfiguracoes.orcamento.titulo}</h2>
        <Campo
          rotulo={textosDeConfiguracoes.orcamento.rotulo}
          dica={textosDeConfiguracoes.orcamento.dica}
          erro={campoOrcamento.erro}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          value={campoOrcamento.texto}
          onChange={campoOrcamento.aoMudarTexto}
          onFocus={campoOrcamento.aoFocar}
          onBlur={campoOrcamento.aoDesfocar}
          onKeyDown={campoOrcamento.aoTeclar}
        />
      </section>

      <section className={estilos['secao']}>
        <h2>{textosDeConfiguracoes.unidades.titulo}</h2>
        <GrupoDeOpcoes
          legenda={textosDeConfiguracoes.unidades.legendaPeso}
          dica={textosDeConfiguracoes.unidades.dicaPeso}
          opcoes={[
            { valor: 'kg', rotulo: textosDeConfiguracoes.unidades.kg },
            { valor: 'lb', rotulo: textosDeConfiguracoes.unidades.lb },
          ]}
          valor={campoUnidadeDePeso.valorExibido}
          aoMudar={campoUnidadeDePeso.aoMudar}
        />
        {campoUnidadeDePeso.erro !== '' ? (
          <Aviso variante="alerta">{campoUnidadeDePeso.erro}</Aviso>
        ) : null}
      </section>

      <section className={estilos['secao']}>
        <h2>{textosDeConfiguracoes.aparencia.titulo}</h2>
        <GrupoDeOpcoes
          legenda={textosDeConfiguracoes.aparencia.legendaTema}
          opcoes={[
            { valor: 'sistema', rotulo: textosDeConfiguracoes.aparencia.sistema },
            { valor: 'claro', rotulo: textosDeConfiguracoes.aparencia.claro },
            { valor: 'escuro', rotulo: textosDeConfiguracoes.aparencia.escuro },
          ]}
          valor={campoTema.valorExibido}
          aoMudar={campoTema.aoMudar}
        />
        {campoTema.erro !== '' ? <Aviso variante="alerta">{campoTema.erro}</Aviso> : null}
      </section>

      <section className={estilos['secao']}>
        <h2>{textosDeConfiguracoes.dados.titulo}</h2>
        <Link to="/dados" className={estilos['linkParaDados']}>
          {textosDeConfiguracoes.dados.link}
        </Link>
      </section>
    </main>
  );
}
