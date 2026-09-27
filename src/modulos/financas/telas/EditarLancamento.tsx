import { useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ehDataDeCalendarioValida, formatarReais, lerCentavosDeReais } from '@/compartilhado';
import { Aviso, Botao, Campo, GrupoDeOpcoes, useTituloDaPagina } from '@/ui';
import { textos } from '@/i18n';
import { editarLancamento, excluirLancamento } from '../repositorio/lancamentos';
import { useCategorias, useLancamento } from '../repositorio/hooks';
import type { TipoDeLancamento } from '../dominio/lancamentos';
import estilos from './EditarLancamento.module.css';

const t = textos.financas.editar;

interface FormularioProps {
  readonly id: string;
  readonly valoresIniciais: {
    readonly tipo: TipoDeLancamento;
    readonly valorCentavos: number;
    readonly categoriaId: string;
    readonly descricao: string | null;
    readonly data: string;
  };
}

/** Separado em componente próprio para inicializar o estado só depois que o lançamento existente carregou. */
function Formulario({ id, valoresIniciais }: FormularioProps) {
  const navegar = useNavigate();
  const categorias = useCategorias();
  const idDoCampoDeCategoria = useId();

  const [tipo, setTipo] = useState<TipoDeLancamento>(valoresIniciais.tipo);
  const [textoDoValor, setTextoDoValor] = useState(formatarReais(valoresIniciais.valorCentavos));
  const [categoriaId, setCategoriaId] = useState(valoresIniciais.categoriaId);
  const [descricao, setDescricao] = useState(valoresIniciais.descricao ?? '');
  const [data, setData] = useState(valoresIniciais.data);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function aoSalvar(): Promise<void> {
    const valorCentavos = lerCentavosDeReais(textoDoValor);
    if (valorCentavos === null || valorCentavos <= 0) {
      setErro(t.erros.valorInvalido);
      return;
    }
    if (!ehDataDeCalendarioValida(data)) {
      setErro(t.erros.dataInvalida);
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      await editarLancamento(id, {
        tipo,
        valorCentavos,
        categoriaId,
        descricao: descricao.trim() === '' ? null : descricao.trim(),
        data,
      });
      void navegar('/financas');
    } catch {
      setErro(t.erros.falhaAoSalvar);
      setSalvando(false);
    }
  }

  async function aoExcluir(): Promise<void> {
    setSalvando(true);
    try {
      await excluirLancamento(id);
      void navegar('/financas');
    } catch {
      setErro(t.erros.falhaAoSalvar);
      setSalvando(false);
    }
  }

  return (
    <>
      <GrupoDeOpcoes
        legenda={t.legendaTipo}
        opcoes={[
          { valor: 'gasto', rotulo: t.opcaoGasto },
          { valor: 'entrada', rotulo: t.opcaoEntrada },
        ]}
        valor={tipo}
        aoMudar={setTipo}
      />

      <Campo
        rotulo={t.rotuloValor}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={textoDoValor}
        onChange={(evento) => setTextoDoValor(evento.target.value)}
      />

      <div className={estilos['campo']}>
        <label className={estilos['rotulo']} htmlFor={idDoCampoDeCategoria}>
          {t.rotuloCategoria}
        </label>
        <select
          id={idDoCampoDeCategoria}
          className={estilos['selecao']}
          value={categoriaId}
          onChange={(evento) => setCategoriaId(evento.target.value)}
        >
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </select>
      </div>

      <Campo
        rotulo={t.rotuloDescricao}
        type="text"
        autoComplete="off"
        value={descricao}
        onChange={(evento) => setDescricao(evento.target.value)}
      />

      <Campo
        rotulo={t.rotuloData}
        type="date"
        value={data}
        onChange={(evento) => setData(evento.target.value)}
      />

      {erro !== '' ? <Aviso variante="alerta">{erro}</Aviso> : null}

      <div className={estilos['acoes']}>
        <Botao aria-busy={salvando} disabled={salvando} onClick={() => void aoSalvar()}>
          {t.botaoSalvar}
        </Botao>
        <Botao variante="secundario" disabled={salvando} onClick={() => void navegar('/financas')}>
          {t.botaoCancelar}
        </Botao>
        <Botao variante="destrutivo" disabled={salvando} onClick={() => void aoExcluir()}>
          {t.botaoExcluir}
        </Botao>
      </div>
    </>
  );
}

/** Tela `/financas/lancamentos/:id/editar` (item 1.1): editar ou excluir um lançamento existente. */
export function EditarLancamento() {
  useTituloDaPagina(textos.comum.tituloDaPagina(t.tituloDaPagina));
  const { id } = useParams<{ id: string }>();
  const lancamento = useLancamento(id ?? '');

  return (
    <main className={estilos['pagina']}>
      <h1>{t.titulo}</h1>

      {lancamento === null ? (
        <>
          <p>{t.naoEncontrado}</p>
          <Link to="/financas">{t.linkVoltar}</Link>
        </>
      ) : null}

      {lancamento ? (
        <Formulario
          id={lancamento.id}
          valoresIniciais={{
            tipo: lancamento.tipo,
            valorCentavos: lancamento.valorCentavos,
            categoriaId: lancamento.categoriaId,
            descricao: lancamento.descricao,
            data: lancamento.data,
          }}
        />
      ) : null}
    </main>
  );
}
