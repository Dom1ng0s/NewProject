import { describe, expect, it } from 'vitest';
import { NOMES_DE_CATEGORIAS_INICIAIS, problemaDeNomeDeCategoria } from './categorias';

describe('NOMES_DE_CATEGORIAS_INICIAIS', () => {
  it('tem as 6 categorias sensatas da especificação (§6.2)', () => {
    expect(NOMES_DE_CATEGORIAS_INICIAIS).toEqual([
      'Alimentação',
      'Transporte',
      'Lazer',
      'Estudos',
      'Moradia',
      'Outros',
    ]);
  });
});

describe('problemaDeNomeDeCategoria', () => {
  it('aceita um nome não vazio', () => {
    expect(problemaDeNomeDeCategoria('Alimentação')).toBeNull();
  });

  it('rejeita vazio e só espaços', () => {
    expect(problemaDeNomeDeCategoria('')).not.toBeNull();
    expect(problemaDeNomeDeCategoria('   ')).not.toBeNull();
  });

  it('rejeita nome com mais de 40 caracteres', () => {
    const nomeGrande = 'a'.repeat(41);
    expect(problemaDeNomeDeCategoria(nomeGrande)).not.toBeNull();
  });

  it('aceita nome com exatamente 40 caracteres (limite, não além dele)', () => {
    const nomeNoLimite = 'a'.repeat(40);
    expect(problemaDeNomeDeCategoria(nomeNoLimite)).toBeNull();
  });
});
