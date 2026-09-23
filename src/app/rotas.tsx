import { BrowserRouter, Routes, Route, Link } from 'react-router';
import { Dados, TelaDeConfiguracoes } from '@/modulos/nucleo';
import { textos } from '@/i18n';
import { contratosDeDados } from './modulos';

/**
 * Placeholder minimo para o item 0.2 (scaffolding). A tela Hoje de verdade
 * chega no item 0.11, consumindo `cartoesDaHoje` de `./modulos`. Os links
 * para `/dados` e `/configuracoes` aqui são só o suficiente para as rotas
 * serem alcançáveis; a navegação de verdade (menu, cartões) chega no item 0.11.
 */
function Hoje() {
  return (
    <p>
      Hoje <Link to="/dados">{textos.nucleo.hoje.linkParaDados}</Link>{' '}
      <Link to="/configuracoes">{textos.nucleo.hoje.linkParaConfiguracoes}</Link>
    </p>
  );
}

export function RotasDoApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Hoje />} />
        <Route path="/dados" element={<Dados contratos={contratosDeDados} />} />
        <Route path="/configuracoes" element={<TelaDeConfiguracoes />} />
      </Routes>
    </BrowserRouter>
  );
}
