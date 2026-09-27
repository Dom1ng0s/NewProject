import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { Aviso, Botao, Campo, useTituloDaPagina } from '@/ui';
import { textos } from '@/i18n';
import { criarCategoria, excluirCategoria, renomearCategoria } from '../repositorio/categorias';
import { useCategorias } from '../repositorio/hooks';
import type { Categoria } from '../repositorio/categorias';
import estilos from './Categorias.module.css';

const t = textos.financas.categorias;

interface LinhaDeCategoriaProps {
  readonly categoria: Categoria;
  readonly aoConcluir: (mensagem: string) => void;
}

function LinhaDeCategoria({ categoria, aoConcluir }: LinhaDeCategoriaProps) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(categoria.nome);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function aoSalvarRenomeacao(): Promise<void> {
    setOcupado(true);
    setErro('');
    try {
      await renomearCategoria(categoria.id, nome);
      setEditando(false);
      aoConcluir(t.renomeada);
    } catch {
      setErro(t.erros.nomeInvalido);
    } finally {
      setOcupado(false);
    }
  }

  async function aoExcluir(): Promise<void> {
    setOcupado(true);
    try {
      await excluirCategoria(categoria.id);
      aoConcluir(t.excluida);
    } catch {
      setErro(t.erros.falhaAoSalvar);
      setOcupado(false);
    }
  }

  if (editando) {
    return (
      <li className={estilos['item']}>
        <Campo
          rotulo={t.rotuloNovaCategoria}
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
        />
        {erro !== '' ? <Aviso variante="alerta">{erro}</Aviso> : null}
        <div className={estilos['acoes']}>
          <Botao aria-busy={ocupado} disabled={ocupado} onClick={() => void aoSalvarRenomeacao()}>
            {t.botaoSalvar}
          </Botao>
          <Botao
            variante="secundario"
            disabled={ocupado}
            onClick={() => {
              setEditando(false);
              setNome(categoria.nome);
              setErro('');
            }}
          >
            {t.botaoCancelar}
          </Botao>
        </div>
      </li>
    );
  }

  return (
    <li className={estilos['item']}>
      <span>{categoria.nome}</span>
      <div className={estilos['acoes']}>
        <Botao variante="secundario" onClick={() => setEditando(true)}>
          {t.botaoRenomear}
        </Botao>
        <Botao variante="destrutivo" disabled={ocupado} onClick={() => void aoExcluir()}>
          {t.botaoExcluir(categoria.nome)}
        </Botao>
      </div>
    </li>
  );
}

/** Tela `/financas/categorias` (item 1.1): criar, renomear e excluir (soft delete) categorias. */
export function Categorias() {
  useTituloDaPagina(textos.comum.tituloDaPagina(t.tituloDaPagina));
  const categorias = useCategorias();
  const [novoNome, setNovoNome] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [criando, setCriando] = useState(false);

  async function aoCriar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setCriando(true);
    setErro('');
    try {
      await criarCategoria(novoNome);
      setNovoNome('');
      setMensagem(t.criada);
    } catch {
      setErro(t.erros.nomeInvalido);
    } finally {
      setCriando(false);
    }
  }

  return (
    <main className={estilos['pagina']}>
      <h1>{t.titulo}</h1>
      <p className={estilos['introducao']}>{t.introducao}</p>
      <p role="status" aria-live="polite" className={estilos['status']}>
        {mensagem}
      </p>

      <form onSubmit={(evento) => void aoCriar(evento)}>
        <Campo
          rotulo={t.rotuloNovaCategoria}
          value={novoNome}
          onChange={(evento) => setNovoNome(evento.target.value)}
        />
        {erro !== '' ? <Aviso variante="alerta">{erro}</Aviso> : null}
        <Botao type="submit" aria-busy={criando} disabled={criando}>
          {t.botaoAdicionar}
        </Botao>
      </form>

      {categorias.length === 0 ? (
        <p>{t.semCategorias}</p>
      ) : (
        <ul className={estilos['lista']}>
          {categorias.map((categoria) => (
            <LinhaDeCategoria key={categoria.id} categoria={categoria} aoConcluir={setMensagem} />
          ))}
        </ul>
      )}

      <p>
        <Link to="/financas">{t.linkVoltar}</Link>
      </p>
    </main>
  );
}
