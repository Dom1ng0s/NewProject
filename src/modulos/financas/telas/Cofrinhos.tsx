import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { ehDataDeCalendarioValida, formatarBRL, hojeEmDataDeCalendario, lerCentavosDeReais } from '@/compartilhado';
import { Aviso, Botao, Campo, useTituloDaPagina } from '@/ui';
import { textos } from '@/i18n';
import { saldoDoCofrinho } from '../dominio/cofrinhos';
import { criarCofrinho } from '../repositorio/cofrinhos';
import type { Cofrinho, DadosDeFormularioDeCofrinho } from '../repositorio/cofrinhos';
import { useCofrinhos, useMovimentosDoCofrinho } from '../repositorio/hooks';
import estilos from './Cofrinhos.module.css';

const t = textos.financas.cofrinhos;

interface LinhaDeCofrinhoProps {
  readonly cofrinho: Cofrinho;
}

function LinhaDeCofrinho({ cofrinho }: LinhaDeCofrinhoProps) {
  const movimentos = useMovimentosDoCofrinho(cofrinho.id);
  const saldo = saldoDoCofrinho(movimentos);
  const saldoNaoNegativo = Math.max(0, saldo);

  return (
    <li className={estilos['item']}>
      <div className={estilos['detalhes']}>
        <strong>{cofrinho.nome}</strong>
        <span>
          {formatarBRL(saldo)} de {formatarBRL(cofrinho.alvoCentavos)}
        </span>
        <progress
          className={estilos['progresso']}
          aria-label={t.rotuloProgresso(cofrinho.nome)}
          value={saldoNaoNegativo}
          max={cofrinho.alvoCentavos}
        />
      </div>
      <Link to={`/financas/cofrinhos/${cofrinho.id}`}>{t.linkVer(cofrinho.nome)}</Link>
    </li>
  );
}

interface CamposDoFormulario {
  readonly nome: string;
  readonly textoDoAlvo: string;
  readonly prazo: string;
}

function formularioVazio(): CamposDoFormulario {
  return { nome: '', textoDoAlvo: '', prazo: '' };
}

function lerFormulario(campos: CamposDoFormulario): DadosDeFormularioDeCofrinho | null {
  const alvoCentavos = lerCentavosDeReais(campos.textoDoAlvo);
  if (campos.nome.trim() === '' || alvoCentavos === null || alvoCentavos <= 0) return null;
  if (campos.prazo !== '' && !ehDataDeCalendarioValida(campos.prazo)) return null;

  return {
    nome: campos.nome.trim(),
    alvoCentavos,
    prazo: campos.prazo === '' ? null : campos.prazo,
  };
}

/** Tela `/financas/cofrinhos` (item 1.5): lista com progresso + criação. */
export function Cofrinhos() {
  useTituloDaPagina(textos.comum.tituloDaPagina(t.tituloDaPagina));
  const cofrinhos = useCofrinhos();

  const [campos, setCampos] = useState<CamposDoFormulario>(formularioVazio);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [criando, setCriando] = useState(false);

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
      await criarCofrinho(dados, hojeEmDataDeCalendario());
      setCampos(formularioVazio());
      setMensagem(t.criado);
    } catch {
      setErro(t.erros.falhaAoSalvar);
    } finally {
      setCriando(false);
    }
  }

  return (
    <main className={estilos['pagina']}>
      <h1>{t.titulo}</h1>
      <p role="status" aria-live="polite" className={estilos['status']}>
        {mensagem}
      </p>

      <section className={estilos['secao']}>
        <h2>{t.novoTitulo}</h2>
        <form onSubmit={(evento) => void aoCriar(evento)}>
          <Campo
            rotulo={t.rotuloNome}
            value={campos.nome}
            onChange={(evento) => setCampos({ ...campos, nome: evento.target.value })}
          />
          <Campo
            rotulo={t.rotuloAlvo}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={campos.textoDoAlvo}
            onChange={(evento) => setCampos({ ...campos, textoDoAlvo: evento.target.value })}
          />
          <Campo
            rotulo={t.rotuloPrazo}
            type="date"
            value={campos.prazo}
            onChange={(evento) => setCampos({ ...campos, prazo: evento.target.value })}
          />
          {erro !== '' ? <Aviso variante="alerta">{erro}</Aviso> : null}
          <Botao type="submit" aria-busy={criando} disabled={criando}>
            {t.botaoAdicionar}
          </Botao>
        </form>
      </section>

      {cofrinhos.length === 0 ? (
        <p>{t.semCofrinhos}</p>
      ) : (
        <ul className={estilos['lista']}>
          {cofrinhos.map((cofrinho) => (
            <LinhaDeCofrinho key={cofrinho.id} cofrinho={cofrinho} />
          ))}
        </ul>
      )}

      <p>
        <Link to="/financas">{t.linkVoltar}</Link>
      </p>
    </main>
  );
}
