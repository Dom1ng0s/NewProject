import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  ehDataDeCalendarioValida,
  hojeEmDataDeCalendario,
  lerCentavosDeReais,
} from '@/compartilhado';
import { Aviso, Botao, Campo, GrupoDeOpcoes, useTituloDaPagina } from '@/ui';
import { textos } from '@/i18n';
import { registrarLancamento } from '../repositorio/lancamentos';
import { useCategoriasPorUso } from '../repositorio/hooks';
import type { TipoDeLancamento } from '../dominio/lancamentos';
import estilos from './NovoLancamento.module.css';

const t = textos.financas.novoLancamento;

/**
 * Gasto em 3 toques (docs/ESPECIFICACAO.md §6.2; pendência 5 do plano): a
 * partir do atalho "Gasto" na Hoje, são 3 interações — abrir esta tela (já
 * contada no toque do atalho), digitar o valor, tocar numa categoria (que
 * salva na hora). Descrição e data são opcionais e não custam toque: data
 * já vem preenchida com hoje, retroativa via `<input type="date">`.
 */
function tipoInicialDaUrl(valor: string | null): TipoDeLancamento {
  return valor === 'entrada' ? 'entrada' : 'gasto';
}

export function NovoLancamento() {
  const navegar = useNavigate();
  const [parametrosDeBusca] = useSearchParams();
  // Só como valor inicial (o atalho "Gasto" da Hoje nunca leva "?tipo=entrada";
  // o link "Nova entrada" de /financas leva): o usuário ainda pode alternar
  // pela GrupoDeOpcoes abaixo.
  const [tipo, setTipo] = useState<TipoDeLancamento>(() =>
    tipoInicialDaUrl(parametrosDeBusca.get('tipo')),
  );
  useTituloDaPagina(
    textos.comum.tituloDaPagina(tipo === 'gasto' ? t.tituloGasto : t.tituloEntrada),
  );

  const categorias = useCategoriasPorUso();
  const [textoDoValor, setTextoDoValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(hojeEmDataDeCalendario());
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const campoDeValorRef = useRef<HTMLInputElement>(null);

  // `autoFocus` (atributo HTML) não é confiável numa navegação de SPA: o
  // elemento nasce depois do carregamento inicial da página, e nem todo
  // motor executa o algoritmo de autofoco fora do parsing do documento.
  // Focar por código no primeiro render garante o campo já pronto para
  // digitar (2º dos 3 toques do gasto).
  useEffect(() => {
    campoDeValorRef.current?.focus();
  }, []);

  const valorCentavos = lerCentavosDeReais(textoDoValor);
  const valorValido = valorCentavos !== null && valorCentavos > 0;
  const dataValida = ehDataDeCalendarioValida(data);
  const podeSalvar = valorValido && dataValida && !salvando;

  async function aoTocarCategoria(categoriaId: string): Promise<void> {
    if (!podeSalvar || valorCentavos === null) return;

    setSalvando(true);
    setErro('');
    try {
      await registrarLancamento({
        tipo,
        valorCentavos,
        categoriaId,
        descricao: descricao.trim() === '' ? null : descricao.trim(),
        data,
        assinaturaId: null,
      });
      void navegar('/financas');
    } catch {
      setErro(t.erros.falhaAoSalvar);
      setSalvando(false);
    }
  }

  return (
    <main className={estilos['pagina']}>
      <h1>{tipo === 'gasto' ? t.tituloGasto : t.tituloEntrada}</h1>

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
        ref={campoDeValorRef}
        rotulo={t.rotuloValor}
        dica={t.dicaValor}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={textoDoValor}
        onChange={(evento) => setTextoDoValor(evento.target.value)}
      />

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

      <h2>{t.categoriaTitulo}</h2>
      <p className={estilos['dica']}>{t.dicaCategoria}</p>
      {categorias.length === 0 ? (
        <p>{t.semCategorias}</p>
      ) : (
        <ul className={estilos['listaDeCategorias']}>
          {categorias.map((categoria) => (
            <li key={categoria.id}>
              <Botao
                disabled={!podeSalvar}
                aria-busy={salvando}
                onClick={() => void aoTocarCategoria(categoria.id)}
              >
                {categoria.nome}
              </Botao>
            </li>
          ))}
        </ul>
      )}

      <p>
        <Link to="/financas/categorias">{t.linkCategorias}</Link>
      </p>
      <p>
        <Link to="/financas">{t.linkVoltar}</Link>
      </p>
    </main>
  );
}
