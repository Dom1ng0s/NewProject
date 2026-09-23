import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { solicitarArmazenamentoPersistente } from '@/modulos/nucleo';
import { App } from './App';
import './estilos/global.css';

const elementoRaiz = document.getElementById('root');
if (!elementoRaiz) {
  throw new Error('Elemento #root nao encontrado.');
}

createRoot(elementoRaiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Pedido de armazenamento persistente (D1, risco 3): uma vez por abertura,
// sem bloquear a UI e sem interface própria. Reduz a chance de o navegador
// apagar o IndexedDB sob pressão de espaço.
void solicitarArmazenamentoPersistente().catch(() => {
  console.warn('Nao foi possivel solicitar armazenamento persistente.');
});
