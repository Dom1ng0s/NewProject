import { BrowserRouter, Routes, Route } from 'react-router';

/**
 * Placeholder minimo para o item 0.2 (scaffolding). A tela Hoje de verdade
 * chega no item 0.11, consumindo `cartoesDaHoje` de `./modulos`.
 */
function Hoje() {
  return <p>Hoje</p>;
}

export function RotasDoApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Hoje />} />
      </Routes>
    </BrowserRouter>
  );
}
