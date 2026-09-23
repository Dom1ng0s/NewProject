import { useState } from 'react';
import { RotasDoApp } from './rotas';
import { AvisoDeAtualizacao } from './atualizacao/AvisoDeAtualizacao';
import { useAtualizacaoDoApp } from './atualizacao/useAtualizacaoDoApp';
import { useAplicarTema } from './tema/useAplicarTema';

export function App() {
  useAplicarTema();
  const { haVersaoNova, atualizar, dispensar } = useAtualizacaoDoApp();
  const [atualizando, setAtualizando] = useState(false);

  function aoAtualizar() {
    setAtualizando(true);
    void atualizar();
  }

  return (
    <>
      {haVersaoNova && (
        <AvisoDeAtualizacao
          aoAtualizar={aoAtualizar}
          aoDispensar={dispensar}
          atualizando={atualizando}
        />
      )}
      <RotasDoApp />
    </>
  );
}
