import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Dados, TelaDeConfiguracoes, TelaHoje } from '@/modulos/nucleo';
import { Categorias, EditarLancamento, Financas, NovoLancamento } from '@/modulos/financas';
import { Moldura } from './layout/Moldura';
import { atalhosDeRegistro, cartoesDaHoje, contratosDeDados } from './modulos';

/**
 * Rotas do app (ADR 0009, seção 1). Uma rota de layout (`<Moldura />`)
 * envolve as três telas: Hoje (`/`), Configurações e Dados (alcançada só
 * pelo link dentro de Configurações). Rota desconhecida volta para a Hoje,
 * em vez de tela em branco — importante offline.
 */
export function RotasDoApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Moldura />}>
          <Route
            path="/"
            element={<TelaHoje cartoes={cartoesDaHoje} atalhos={atalhosDeRegistro} />}
          />
          <Route path="/configuracoes" element={<TelaDeConfiguracoes />} />
          <Route path="/dados" element={<Dados contratos={contratosDeDados} />} />
          <Route path="/financas" element={<Financas />} />
          <Route path="/financas/novo-lancamento" element={<NovoLancamento />} />
          <Route path="/financas/categorias" element={<Categorias />} />
          <Route path="/financas/lancamentos/:id/editar" element={<EditarLancamento />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
