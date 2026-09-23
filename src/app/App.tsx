import { RotasDoApp } from './rotas';
import { useAplicarTema } from './tema/useAplicarTema';

export function App() {
  useAplicarTema();
  return <RotasDoApp />;
}
