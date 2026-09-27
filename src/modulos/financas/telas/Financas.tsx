import { Link } from 'react-router';
import { formatarBRL, hojeEmDataDeCalendario } from '@/compartilhado';
import { useConfiguracoes } from '@/modulos/nucleo';
import { useTituloDaPagina } from '@/ui';
import { textos } from '@/i18n';
import { useCategorias, useDisponivelHoje, useLancamentosDoMes } from '../repositorio/hooks';
import estilos from './Financas.module.css';

const t = textos.financas.pagina;

/**
 * Tela principal do pilar (`/financas`, alcançada pelo link do cartão da
 * Hoje, ADR 0009 seção 3.3, regra 5): disponível hoje, atalhos para novo
 * gasto/entrada, categorias, e a lista de lançamentos do mês corrente com
 * editar/excluir (item 1.1).
 */
export function Financas() {
  useTituloDaPagina(textos.comum.tituloDaPagina(t.titulo));

  const configuracoes = useConfiguracoes();
  const disponivel = useDisponivelHoje();
  const anoMes = hojeEmDataDeCalendario().slice(0, 7);
  const lancamentos = useLancamentosDoMes(anoMes);
  const categorias = useCategorias();

  const nomeDaCategoria = new Map(categorias.map((categoria) => [categoria.id, categoria.nome]));
  const valorEmCentavos = disponivel ?? 0;
  const negativo = valorEmCentavos < 0;

  return (
    <main className={estilos['pagina']}>
      <h1>{t.titulo}</h1>

      <section className={estilos['secao']}>
        {configuracoes.orcamentoMensalEmCentavos === null ? (
          <>
            <p>{t.semOrcamento}</p>
            <Link to="/configuracoes">{t.linkDefinirOrcamento}</Link>
          </>
        ) : (
          <p className={negativo ? estilos['destaqueNegativo'] : estilos['destaque']}>
            {negativo
              ? t.excedidoHoje(formatarBRL(Math.abs(valorEmCentavos)))
              : t.disponivelHoje(formatarBRL(valorEmCentavos))}
          </p>
        )}
      </section>

      <section className={estilos['secao']}>
        <div className={estilos['acoes']}>
          <Link to="/financas/novo-lancamento" className="botao botao--primario">
            {t.botaoNovoGasto}
          </Link>
          <Link to="/financas/novo-lancamento?tipo=entrada" className="botao botao--secundario">
            {t.botaoNovaEntrada}
          </Link>
        </div>
        <Link to="/financas/categorias">{t.linkCategorias}</Link>
        {' · '}
        <Link to="/financas/assinaturas">{t.linkAssinaturas}</Link>
        {' · '}
        <Link to="/financas/cofrinhos">{t.linkCofrinhos}</Link>
      </section>

      <section className={estilos['secao']}>
        <h2>{t.listaTitulo}</h2>
        {lancamentos.length === 0 ? (
          <p>{t.semLancamentos}</p>
        ) : (
          <ul className={estilos['lista']}>
            {lancamentos.map((lancamento) => {
              const rotuloDaCategoria = nomeDaCategoria.get(lancamento.categoriaId) ?? '—';
              const rotuloDoTipo =
                lancamento.tipo === 'gasto' ? t.colunaTipoGasto : t.colunaTipoEntrada;
              const descricaoParaLeitorDeTela = [
                rotuloDoTipo,
                formatarBRL(lancamento.valorCentavos),
                rotuloDaCategoria,
                lancamento.data,
                lancamento.descricao,
              ]
                .filter((parte): parte is string => Boolean(parte))
                .join(', ');

              return (
                <li key={lancamento.id} className={estilos['item']}>
                  <span>
                    {rotuloDoTipo} · {formatarBRL(lancamento.valorCentavos)} · {rotuloDaCategoria} ·{' '}
                    {lancamento.data}
                    {lancamento.descricao ? ` · ${lancamento.descricao}` : ''}
                  </span>
                  <Link
                    to={`/financas/lancamentos/${lancamento.id}/editar`}
                    aria-label={t.botaoEditar(descricaoParaLeitorDeTela)}
                  >
                    {t.linkEditar}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
