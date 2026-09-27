import { useProcessarCobrancasAutomaticas } from '@/modulos/financas';
import { RotasDoApp } from './rotas';
import { useAplicarTema } from './tema/useAplicarTema';

/**
 * `useProcessarCobrancasAutomaticas` (item 1.3) roda aqui, fora das rotas: a
 * cobrança automática de assinaturas precisa acontecer "ao abrir o app e ao
 * voltar para o app" (D1: aviso dentro do app, sem notificação push),
 * independente de qual tela está montada — não só quando o cartão de
 * Finanças da Hoje está visível.
 */
export function App() {
  useAplicarTema();
  useProcessarCobrancasAutomaticas();
  return <RotasDoApp />;
}
