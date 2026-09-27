import { useEffect } from 'react';
import { Link } from 'react-router';
import { formatarBRL } from '@/compartilhado';
import { useConfiguracoes } from '@/modulos/nucleo';
import { textos } from '@/i18n';
import { useAssinaturasParaAvisoDeRenovacao, useDisponivelHoje } from '../repositorio/hooks';
import estilos from './CartaoFinancas.module.css';

const t = textos.financas.hoje;

/**
 * Selo no ícone do app (item 1.4, D1: aviso dentro do app, sem notificação
 * push) com a quantidade de assinaturas a vencer em breve. `setAppBadge`/
 * `clearAppBadge` não existem em todo navegador — checagem de suporte
 * (`'setAppBadge' in navigator`) evita erro onde a API não existe (ex.:
 * Firefox, Safari fora do PWA instalado).
 */
function useSeloDeRenovacoes(quantidade: number): void {
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    if (quantidade > 0) {
      void (navigator as { setAppBadge: (n: number) => Promise<void> }).setAppBadge(quantidade);
    } else if ('clearAppBadge' in navigator) {
      void (navigator as { clearAppBadge: () => Promise<void> }).clearAppBadge();
    }
  }, [quantidade]);
}

/**
 * Conteúdo do cartão de finanças na Hoje (ADR 0009, seção 3): só o
 * conteúdo, sem `<section>`/`<h2>` — a moldura da Hoje desenha os dois.
 * Regra 7.3 (disponível hoje) + aviso de renovação de assinaturas (item 1.4).
 * Sem orçamento definido (D11), mostra o convite para configurar em vez de
 * calcular com um valor inventado — mas o aviso de renovação aparece de
 * qualquer forma, já que não depende de orçamento.
 */
export function CartaoFinancas() {
  const configuracoes = useConfiguracoes();
  const disponivel = useDisponivelHoje();
  const assinaturasParaAvisar = useAssinaturasParaAvisoDeRenovacao();
  useSeloDeRenovacoes(assinaturasParaAvisar.length);

  const avisoDeRenovacao =
    assinaturasParaAvisar.length > 0 ? (
      <div className={estilos['aviso']}>
        <h3>{t.avisoDeRenovacao.titulo}</h3>
        <ul className={estilos['listaDeAvisos']}>
          {assinaturasParaAvisar.map((assinatura) => (
            <li key={assinatura.id}>
              {t.avisoDeRenovacao.item(
                assinatura.nome,
                formatarBRL(assinatura.valorCentavos),
                assinatura.proximaCobranca,
              )}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  if (configuracoes.orcamentoMensalEmCentavos === null) {
    return (
      <>
        <p className={estilos['texto']}>{t.semOrcamento}</p>
        <Link to="/configuracoes">{t.linkDefinirOrcamento}</Link>
        {avisoDeRenovacao}
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
      {avisoDeRenovacao}
    </>
  );
}
