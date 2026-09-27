import { Link } from 'react-router';
import { formatarBRL } from '@/compartilhado';
import { useConfiguracoes } from '@/modulos/nucleo';
import { textos } from '@/i18n';
import { useDisponivelHoje } from '../repositorio/hooks';
import estilos from './CartaoFinancas.module.css';

const t = textos.financas.hoje;

/**
 * Conteúdo do cartão de finanças na Hoje (ADR 0009, seção 3): só o
 * conteúdo, sem `<section>`/`<h2>` — a moldura da Hoje desenha os dois.
 * Regra 7.3 (disponível hoje). Sem orçamento definido (D11), mostra o
 * convite para configurar em vez de calcular com um valor inventado.
 */
export function CartaoFinancas() {
  const configuracoes = useConfiguracoes();
  const disponivel = useDisponivelHoje();

  if (configuracoes.orcamentoMensalEmCentavos === null) {
    return (
      <>
        <p className={estilos['texto']}>{t.semOrcamento}</p>
        <Link to="/configuracoes">{t.linkDefinirOrcamento}</Link>
      </>
    );
  }

  // `disponivel` só é `null` quando não há orçamento (já tratado acima); com
  // orçamento definido, `disponivelHoje` sempre devolve número. O `?? 0` é só
  // uma salvaguarda de tipo, nunca alcançada na prática.
  const valorEmCentavos = disponivel ?? 0;
  const negativo = valorEmCentavos < 0;

  return (
    <>
      <p className={negativo ? estilos['destaqueNegativo'] : estilos['destaque']}>
        {negativo
          ? t.excedido(formatarBRL(Math.abs(valorEmCentavos)))
          : t.disponivel(formatarBRL(valorEmCentavos))}
      </p>
      <Link to="/financas">{t.linkVerFinancas}</Link>
    </>
  );
}
