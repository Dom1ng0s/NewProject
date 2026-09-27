import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { formatarBRL, hojeEmDataDeCalendario, lerCentavosDeReais } from '@/compartilhado';
import { saldoDoCofrinho } from '../dominio/cofrinhos';
import { Aviso, Botao, Campo, useTituloDaPagina } from '@/ui';
import { textos } from '@/i18n';
import { excluirCofrinho, registrarMovimentoDeCofrinho } from '../repositorio/cofrinhos';
import {
  useCofrinho,
  useMovimentosDoCofrinho,
  useProjecaoDoCofrinho,
} from '../repositorio/hooks';
import estilos from './CofrinhoDetalhe.module.css';

const t = textos.financas.cofrinhoDetalhe;

interface ConteudoProps {
  readonly id: string;
}

function Conteudo({ id }: ConteudoProps) {
  const navegar = useNavigate();
  const cofrinho = useCofrinho(id);
  const movimentos = useMovimentosDoCofrinho(id);
  const projecao = useProjecaoDoCofrinho(cofrinho, movimentos);

  const [textoDoValor, setTextoDoValor] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (cofrinho === undefined) return null;
  if (cofrinho === null) {
    return (
      <>
        <p>{t.naoEncontrado}</p>
        <Link to="/financas/cofrinhos">{t.linkVoltar}</Link>
      </>
    );
  }

  const saldo = saldoDoCofrinho(movimentos);
  const saldoNaoNegativo = Math.max(0, saldo);

  async function aoMovimentar(sinal: 1 | -1): Promise<void> {
    const valorDigitado = lerCentavosDeReais(textoDoValor);
    if (valorDigitado === null || valorDigitado <= 0) {
      setErro(t.erros.valorInvalido);
      return;
    }
    setOcupado(true);
    setErro('');
    try {
      await registrarMovimentoDeCofrinho(id, valorDigitado * sinal, hojeEmDataDeCalendario());
      setTextoDoValor('');
    } catch {
      setErro(t.erros.falhaAoSalvar);
    } finally {
      setOcupado(false);
    }
  }

  async function aoExcluir(): Promise<void> {
    setOcupado(true);
    try {
      await excluirCofrinho(id);
      void navegar('/financas/cofrinhos');
    } catch {
      setErro(t.erros.falhaAoSalvar);
      setOcupado(false);
    }
  }

  function textoDaProjecao(): string {
    if (!projecao) return '';
    if (projecao.tipo === 'concluido') return t.projecao.concluido;
    if (projecao.tipo === 'semProjecao') return t.projecao.semProjecao;
    return t.projecao.data(projecao.data);
  }

  return (
    <>
      <p className={estilos['destaque']}>{cofrinho.nome}</p>
      <p className={estilos['destaque']}>{t.saldo(formatarBRL(saldo))}</p>
      <p>{t.alvo(formatarBRL(cofrinho.alvoCentavos))}</p>
      <p>{cofrinho.prazo ? t.prazo(cofrinho.prazo) : t.semPrazo}</p>
      <progress
        className={estilos['progresso']}
        aria-label={textos.financas.cofrinhos.rotuloProgresso(cofrinho.nome)}
        value={saldoNaoNegativo}
        max={cofrinho.alvoCentavos}
      />
      <p role="status" aria-live="polite">
        {textoDaProjecao()}
      </p>

      <section className={estilos['secao']}>
        <Campo
          rotulo={t.rotuloValorMovimento}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={textoDoValor}
          onChange={(evento) => setTextoDoValor(evento.target.value)}
        />
        {erro !== '' ? <Aviso variante="alerta">{erro}</Aviso> : null}
        <div className={estilos['acoes']}>
          <Botao disabled={ocupado} onClick={() => void aoMovimentar(1)}>
            {t.botaoDepositar}
          </Botao>
          <Botao variante="secundario" disabled={ocupado} onClick={() => void aoMovimentar(-1)}>
            {t.botaoRetirar}
          </Botao>
        </div>
      </section>

      <section className={estilos['secao']}>
        <h2>{t.listaMovimentosTitulo}</h2>
        {movimentos.length === 0 ? (
          <p>{t.semMovimentos}</p>
        ) : (
          <ul className={estilos['lista']}>
            {movimentos.map((movimento) => (
              <li key={movimento.id}>
                {movimento.valorCentavos >= 0
                  ? t.movimentoDeposito(formatarBRL(movimento.valorCentavos), movimento.data)
                  : t.movimentoRetirada(formatarBRL(Math.abs(movimento.valorCentavos)), movimento.data)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Botao variante="destrutivo" disabled={ocupado} onClick={() => void aoExcluir()}>
        {t.botaoExcluirCofrinho}
      </Botao>
      <p>
        <Link to="/financas/cofrinhos">{t.linkVoltar}</Link>
      </p>
    </>
  );
}

/** Tela `/financas/cofrinhos/:id` (item 1.5): saldo, alvo, projeção (regra 7.4), depósitos/retiradas, movimentos. */
export function CofrinhoDetalhe() {
  useTituloDaPagina(textos.comum.tituloDaPagina(t.tituloDaPagina));
  const { id } = useParams<{ id: string }>();

  return (
    <main className={estilos['pagina']}>
      <h1>{t.titulo}</h1>
      <Conteudo id={id ?? ''} />
    </main>
  );
}
