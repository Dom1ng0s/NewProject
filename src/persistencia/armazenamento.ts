/**
 * Mitigação do risco técnico 3 (D1): pede ao navegador para não limpar o
 * armazenamento do site automaticamente sob pressão de espaço. Detecção de
 * recurso — navegadores sem a API devolvem `false` em vez de lançar.
 *
 * Não é chamado por este arquivo: quem chama é a casca do app, no item 0.7
 * (agente `interface`), que não pode criar arquivo dentro de `persistencia/`.
 */
export async function solicitarArmazenamentoPersistente(): Promise<boolean> {
  const concedido = await navigator.storage?.persist?.();
  return concedido ?? false;
}
