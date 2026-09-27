import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import {
  ehDataDeCalendarioValida,
  formatarBRL,
  hojeEmDataDeCalendario,
  lerCentavosDeReais,
  lerInteiro,
} from '@/compartilhado';
import { Aviso, Botao, Campo, GrupoDeOpcoes, useTituloDaPagina } from '@/ui';
import { textos } from '@/i18n';
import {
  custoPorUsoNoMes,
  totalAnualDeAssinaturas,
  totalMensalDeAssinaturas,
  valorMensalEquivalente,
} from '../dominio/assinaturas';
import type { Periodicidade } from '../dominio/assinaturas';
import {
  criarAssinatura,
  editarAssinatura,
  excluirAssinatura,
  registrarUsoHoje,
} from '../repositorio/assinaturas';
import type { Assinatura, DadosDeFormularioDeAssinatura } from '../repositorio/assinaturas';
import { useAssinaturas, useCategorias, useUsosNoMes } from '../repositorio/hooks';
import type { Categoria } from '../repositorio/categorias';
import estilos from './Assinaturas.module.css';

const t = textos.financas.assinaturas;

interface CamposDoFormulario {
  readonly nome: string;
  readonly textoDoValor: string;
  readonly periodicidade: Periodicidade;
  readonly proximaCobranca: string;
  readonly textoDeDiasDeAviso: string;
  readonly categoriaId: string;
}

function categoriaPadrao(categorias: readonly Categoria[]): string {
  return categorias.find((categoria) => categoria.nome === 'Outros')?.id ?? (categorias[0]?.id ?? '');
}

function formularioVazio(categorias: readonly Categoria[]): CamposDoFormulario {
  return {
    nome: '',
    textoDoValor: '',
    periodicidade: 'mensal',
    proximaCobranca: hojeEmDataDeCalendario(),
    textoDeDiasDeAviso: '3',
    categoriaId: categoriaPadrao(categorias),
  };
}

/** Lê os campos do formulário; `null` se algum for inválido. */
function lerFormulario(campos: CamposDoFormulario): DadosDeFormularioDeAssinatura | null {
  const valorCentavos = lerCentavosDeReais(campos.textoDoValor);
  const diasDeAviso = lerInteiro(campos.textoDeDiasDeAviso);

  if (
    campos.nome.trim() === '' ||
    valorCentavos === null ||
    valorCentavos <= 0 ||
    !ehDataDeCalendarioValida(campos.proximaCobranca) ||
    diasDeAviso === null ||
    diasDeAviso < 0 ||
    campos.categoriaId === ''
  ) {
    return null;
  }

  return {
    nome: campos.nome.trim(),
    valorCentavos,
    periodicidade: campos.periodicidade,
    proximaCobranca: campos.proximaCobranca,
    diasDeAviso,
    categoriaId: campos.categoriaId,
  };
}

interface CamposDeFormularioProps {
  readonly valores: CamposDoFormulario;
  readonly aoMudar: (valores: CamposDoFormulario) => void;
  readonly categorias: readonly Categoria[];
}

function CamposDeFormularioDeAssinatura({ valores, aoMudar, categorias }: CamposDeFormularioProps) {
  return (
    <>
      <Campo
        rotulo={t.rotuloNome}
        value={valores.nome}
        onChange={(evento) => aoMudar({ ...valores, nome: evento.target.value })}
      />
      <Campo
        rotulo={t.rotuloValor}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={valores.textoDoValor}
        onChange={(evento) => aoMudar({ ...valores, textoDoValor: evento.target.value })}
      />
      <GrupoDeOpcoes
        legenda={t.legendaPeriodicidade}
        opcoes={[
          { valor: 'mensal', rotulo: t.opcaoMensal },
          { valor: 'anual', rotulo: t.opcaoAnual },
        ]}
        valor={valores.periodicidade}
        aoMudar={(periodicidade) => aoMudar({ ...valores, periodicidade })}
      />
      <Campo
        rotulo={t.rotuloProximaCobranca}
        type="date"
        value={valores.proximaCobranca}
        onChange={(evento) => aoMudar({ ...valores, proximaCobranca: evento.target.value })}
      />
      <Campo
        rotulo={t.rotuloDiasDeAviso}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={valores.textoDeDiasDeAviso}
        onChange={(evento) => aoMudar({ ...valores, textoDeDiasDeAviso: evento.target.value })}
      />
      <div className={estilos['campo']}>
        <label className={estilos['rotulo']} htmlFor="categoria-da-assinatura">
          {t.rotuloCategoria}
        </label>
        <select
          id="categoria-da-assinatura"
          className={estilos['selecao']}
          value={valores.categoriaId}
          onChange={(evento) => aoMudar({ ...valores, categoriaId: evento.target.value })}
        >
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

interface LinhaDeAssinaturaProps {
  readonly assinatura: Assinatura;
  readonly categorias: readonly Categoria[];
  readonly aoConcluir: (mensagem: string) => void;
}

function LinhaDeAssinatura({ assinatura, categorias, aoConcluir }: LinhaDeAssinaturaProps) {
  const hoje = hojeEmDataDeCalendario();
  const anoMes = hoje.slice(0, 7);
  const usosNoMes = useUsosNoMes(assinatura.id);
  const [editando, setEditando] = useState(false);
  const [campos, setCampos] = useState<CamposDoFormulario>(() => ({
    nome: assinatura.nome,
    textoDoValor: formatarBRL(assinatura.valorCentavos).replace('R$ ', ''),
    periodicidade: assinatura.periodicidade,
    proximaCobranca: assinatura.proximaCobranca,
    textoDeDiasDeAviso: String(assinatura.diasDeAviso),
    categoriaId: assinatura.categoriaId,
  }));
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const valorMensal = valorMensalEquivalente(assinatura);
  const custoPorUso = custoPorUsoNoMes(valorMensal, usosNoMes);
  const nomeDaCategoria = categorias.find((c) => c.id === assinatura.categoriaId)?.nome ?? '—';

  async function aoUsarHoje(): Promise<void> {
    setOcupado(true);
    try {
      await registrarUsoHoje(assinatura.id, hoje);
      aoConcluir(t.usadoHoje);
    } catch {
      setErro(t.erros.falhaAoSalvar);
    } finally {
      setOcupado(false);
    }
  }

  async function aoSalvar(): Promise<void> {
    const dados = lerFormulario(campos);
    if (!dados) {
      setErro(t.erros.dadosInvalidos);
      return;
    }
    setOcupado(true);
    setErro('');
    try {
      await editarAssinatura(assinatura.id, dados);
      setEditando(false);
      aoConcluir(t.editada);
    } catch {
      setErro(t.erros.falhaAoSalvar);
    } finally {
      setOcupado(false);
    }
  }

  async function aoExcluir(): Promise<void> {
    setOcupado(true);
    try {
      await excluirAssinatura(assinatura.id);
      aoConcluir(t.excluida);
    } catch {
      setErro(t.erros.falhaAoSalvar);
      setOcupado(false);
    }
  }

  if (editando) {
    return (
      <li className={estilos['item']}>
        <CamposDeFormularioDeAssinatura valores={campos} aoMudar={setCampos} categorias={categorias} />
        {erro !== '' ? <Aviso variante="alerta">{erro}</Aviso> : null}
        <div className={estilos['acoes']}>
          <Botao aria-busy={ocupado} disabled={ocupado} onClick={() => void aoSalvar()}>
            {t.botaoSalvar}
          </Botao>
          <Botao variante="secundario" disabled={ocupado} onClick={() => setEditando(false)}>
            {t.botaoCancelar}
          </Botao>
        </div>
      </li>
    );
  }

  return (
    <li className={estilos['item']}>
      <div className={estilos['detalhes']}>
        <strong>{assinatura.nome}</strong>
        <span>
          {formatarBRL(assinatura.valorCentavos)} ·{' '}
          {assinatura.periodicidade === 'mensal' ? t.opcaoMensal : t.opcaoAnual} · {nomeDaCategoria}
        </span>
        <span>{t.rotuloProximaCobranca}: {assinatura.proximaCobranca}</span>
        <span>{custoPorUso === null ? t.semUsoEsteMes : t.custoPorUso(formatarBRL(custoPorUso))}</span>
      </div>
      {erro !== '' ? <Aviso variante="alerta">{erro}</Aviso> : null}
      <div className={estilos['acoes']}>
        <Botao disabled={ocupado} onClick={() => void aoUsarHoje()}>
          {t.botaoUseiHoje}
        </Botao>
        <Botao variante="secundario" onClick={() => setEditando(true)}>
          {t.botaoEditar}
        </Botao>
        <Botao variante="destrutivo" disabled={ocupado} onClick={() => void aoExcluir()}>
          {t.botaoExcluir(assinatura.nome)}
        </Botao>
      </div>
    </li>
  );
}

/** Tela `/financas/assinaturas` (item 1.3): totais, "usei hoje", custo por uso, CRUD. */
export function Assinaturas() {
  useTituloDaPagina(textos.comum.tituloDaPagina(t.tituloDaPagina));
  const assinaturas = useAssinaturas();
  const categorias = useCategorias();

  const [campos, setCampos] = useState<CamposDoFormulario>(() => formularioVazio([]));
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [criando, setCriando] = useState(false);
  const categoriaPadraoJaAplicadaRef = useRef(false);

  // Só preenche a categoria padrão UMA vez, quando as categorias chegarem
  // (useLiveQuery começa vazio) — não sobrescreve o que o usuário já escolheu.
  useEffect(() => {
    if (categoriaPadraoJaAplicadaRef.current || categorias.length === 0) return;
    categoriaPadraoJaAplicadaRef.current = true;
    setCampos((atuais) => ({ ...atuais, categoriaId: categoriaPadrao(categorias) }));
  }, [categorias]);

  async function aoCriar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    const dados = lerFormulario(campos);
    if (!dados) {
      setErro(t.erros.dadosInvalidos);
      return;
    }
    setCriando(true);
    setErro('');
    try {
      await criarAssinatura(dados);
      setCampos(formularioVazio(categorias));
      setMensagem(t.criada);
    } catch {
      setErro(t.erros.falhaAoSalvar);
    } finally {
      setCriando(false);
    }
  }

  const totalMensal = totalMensalDeAssinaturas(assinaturas);
  const totalAnual = totalAnualDeAssinaturas(assinaturas);

  return (
    <main className={estilos['pagina']}>
      <h1>{t.titulo}</h1>
      <p role="status" aria-live="polite" className={estilos['status']}>
        {mensagem}
      </p>

      <section className={estilos['secao']}>
        <p className={estilos['destaque']}>{t.totalMensal(formatarBRL(totalMensal))}</p>
        <p className={estilos['destaque']}>{t.totalAnual(formatarBRL(totalAnual))}</p>
      </section>

      <section className={estilos['secao']}>
        <h2>{t.novaTitulo}</h2>
        <form onSubmit={(evento) => void aoCriar(evento)}>
          <CamposDeFormularioDeAssinatura valores={campos} aoMudar={setCampos} categorias={categorias} />
          {erro !== '' ? <Aviso variante="alerta">{erro}</Aviso> : null}
          <Botao type="submit" aria-busy={criando} disabled={criando}>
            {t.botaoAdicionar}
          </Botao>
        </form>
      </section>

      {assinaturas.length === 0 ? (
        <p>{t.semAssinaturas}</p>
      ) : (
        <ul className={estilos['lista']}>
          {assinaturas.map((assinatura) => (
            <LinhaDeAssinatura
              key={assinatura.id}
              assinatura={assinatura}
              categorias={categorias}
              aoConcluir={setMensagem}
            />
          ))}
        </ul>
      )}

      <p>
        <Link to="/financas">{t.linkVoltar}</Link>
      </p>
    </main>
  );
}
