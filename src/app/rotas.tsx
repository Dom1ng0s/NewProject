import { BrowserRouter, Routes, Route, Link } from 'react-router';
import { Dados } from '@/modulos/nucleo';
import { textos } from '@/i18n';
import { contratosDeDados } from './modulos';

/**
 * Placeholder minimo para o item 0.2 (scaffolding). A tela Hoje de verdade
 * chega no item 0.11, consumindo `cartoesDaHoje` de `./modulos`. O link para
 * `/dados` aqui é só o suficiente para a rota ser alcançável; a navegação de
 * verdade (menu, cartões) chega no item 0.11.
 */
function Hoje() {
  return (
    <p>
      Hoje <Link to="/dados">{textos.nucleo.hoje.linkParaDados}</Link>
    </p>
  );
}

export function RotasDoApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Hoje />} />
        <Route path="/dados" element={<Dados contratos={contratosDeDados} />} />
      </Routes>
    </BrowserRouter>
  );
}
