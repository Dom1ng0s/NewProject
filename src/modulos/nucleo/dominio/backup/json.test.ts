/**
 * `dominio/backup/json.ts` (ADR 0006, seção 2.3): monta/serializa o envelope
 * e valida sem tocar no banco (`lerBackup` é puro — nenhum destes testes
 * importa `@/persistencia` nem `dexie`, de propósito). Cobre o critério de
 * aceite 10 do ADR (uma entrada por código de erro) e o 5 (metadados sem
 * rastro).
 */
import { describe, expect, it } from 'vitest';
import { FORMATO_DO_BACKUP, VERSAO_DO_FORMATO_DE_BACKUP } from './formato';
import { montarBackup, serializarBackup, lerBackup, validarRegistrosDaTabela } from './json';
import { ErroDeBackup, ehErroDeBackup } from './erros';
import type { CodigoDeErroDeBackup } from './erros';

const REGISTRO_VALIDO = {
  id: 'registro-1',
  createdAt: '2026-09-22T17:00:00.000Z',
  updatedAt: '2026-09-22T17:00:00.000Z',
  deletedAt: null,
};

const METADADOS_VALIDOS = {
  formato: FORMATO_DO_BACKUP,
  versaoDoFormato: VERSAO_DO_FORMATO_DE_BACKUP,
  versaoDoSchema: 1,
  geradoEm: '2026-09-22T18:04:05.123Z',
};

/** Monta um envelope válido como TEXTO, com overrides pontuais para cada teste de erro. */
function textoDoEnvelope(opcoes?: {
  readonly metadados?: Record<string, unknown>;
  readonly modulos?: Record<string, unknown>;
}): string {
  return JSON.stringify({
    metadados: { ...METADADOS_VALIDOS, ...opcoes?.metadados },
    modulos: opcoes?.modulos ?? {},
  });
}

describe('montarBackup', () => {
  it('critério 5: as chaves de metadados são exatamente formato, versaoDoFormato, versaoDoSchema, geradoEm', () => {
    const arquivo = montarBackup({
      geradoEm: '2026-09-22T18:04:05.123Z',
      versaoDoSchema: 1,
      modulos: {},
    });

    expect(Object.keys(arquivo.metadados).sort()).toEqual(
      ['formato', 'geradoEm', 'versaoDoFormato', 'versaoDoSchema'].sort(),
    );
    expect(arquivo.metadados).toEqual({
      formato: FORMATO_DO_BACKUP,
      versaoDoFormato: VERSAO_DO_FORMATO_DE_BACKUP,
      versaoDoSchema: 1,
      geradoEm: '2026-09-22T18:04:05.123Z',
    });
  });

  it('devolve os módulos exatamente como recebidos (passagem pura, sem recalcular nada)', () => {
    const modulos = { nucleo: { configuracoes: [], historicoDeAcoes: [] } };
    const arquivo = montarBackup({
      geradoEm: '2026-09-22T18:04:05.123Z',
      versaoDoSchema: 1,
      modulos,
    });
    expect(arquivo.modulos).toBe(modulos);
  });
});

describe('serializarBackup', () => {
  it('JSON indentado com 2 espaços e uma quebra de linha final (ADR seção 1, regra 3)', () => {
    const arquivo = montarBackup({
      geradoEm: '2026-09-22T18:04:05.123Z',
      versaoDoSchema: 1,
      modulos: {},
    });
    const texto = serializarBackup(arquivo);

    expect(texto.endsWith('}\n')).toBe(true);
    expect(texto.startsWith('{\n  "metadados"')).toBe(true);
    expect(texto.charCodeAt(0)).not.toBe(0xfeff); // sem BOM (diferente do CSV)
  });
});

describe('lerBackup — critério 10 (uma entrada por código de erro)', () => {
  it('texto vazio → jsonInvalido', () => {
    const leitura = lerBackup('', 1);
    if (leitura.ok) throw new Error('deveria ter reprovado');
    expect(leitura.erro).toBeInstanceOf(ErroDeBackup);
    expect(leitura.erro.codigo).toBe('jsonInvalido');
  });

  it("'{' (JSON incompleto) → jsonInvalido", () => {
    const leitura = lerBackup('{', 1);
    if (leitura.ok) throw new Error('deveria ter reprovado');
    expect(leitura.erro.codigo).toBe('jsonInvalido');
  });

  it('{} (sem metadados nem modulos) → naoEhBackup', () => {
    const leitura = lerBackup('{}', 1);
    if (leitura.ok) throw new Error('deveria ter reprovado');
    expect(leitura.erro.codigo).toBe('naoEhBackup');
  });

  it('metadados.formato diferente → naoEhBackup', () => {
    const leitura = lerBackup(JSON.stringify({ metadados: { formato: 'outro' }, modulos: {} }), 1);
    if (leitura.ok) throw new Error('deveria ter reprovado');
    expect(leitura.erro.codigo).toBe('naoEhBackup');
  });

  it('versaoDoFormato maior que o suportado → formatoMaisNovo', () => {
    const leitura = lerBackup(textoDoEnvelope({ metadados: { versaoDoFormato: 2 } }), 1);
    if (leitura.ok) throw new Error('deveria ter reprovado');
    expect(leitura.erro.codigo).toBe('formatoMaisNovo');
  });

  it('versaoDoFormato menor que o suportado → formatoMaisAntigo', () => {
    const leitura = lerBackup(textoDoEnvelope({ metadados: { versaoDoFormato: 0 } }), 1);
    if (leitura.ok) throw new Error('deveria ter reprovado');
    expect(leitura.erro.codigo).toBe('formatoMaisAntigo');
  });

  it('versaoDoSchema maior que o atual (2 > 1) → schemaMaisNovo', () => {
    const leitura = lerBackup(textoDoEnvelope({ metadados: { versaoDoSchema: 2 } }), 1);
    if (leitura.ok) throw new Error('deveria ter reprovado');
    expect(leitura.erro.codigo).toBe('schemaMaisNovo');
  });

  it('versaoDoSchema menor que o atual (1 < 2) → schemaMaisAntigo', () => {
    const leitura = lerBackup(textoDoEnvelope({ metadados: { versaoDoSchema: 1 } }), 2);
    if (leitura.ok) throw new Error('deveria ter reprovado');
    expect(leitura.erro.codigo).toBe('schemaMaisAntigo');
  });

  it('chave de módulo desconhecida ("saude") → moduloDesconhecido', () => {
    const leitura = lerBackup(textoDoEnvelope({ modulos: { saude: {} } }), 1);
    if (leitura.ok) throw new Error('deveria ter reprovado');
    expect(leitura.erro.codigo).toBe('moduloDesconhecido');
  });

  it('modulos.nucleo.configuracoes não é uma lista ({} em vez de []) → estruturaInvalida', () => {
    const leitura = lerBackup(textoDoEnvelope({ modulos: { nucleo: { configuracoes: {} } } }), 1);
    if (leitura.ok) throw new Error('deveria ter reprovado');
    expect(leitura.erro.codigo).toBe('estruturaInvalida');
  });

  it('registro sem id → registroInvalido', () => {
    const semId = {
      createdAt: REGISTRO_VALIDO.createdAt,
      updatedAt: REGISTRO_VALIDO.updatedAt,
      deletedAt: REGISTRO_VALIDO.deletedAt,
    };
    const leitura = lerBackup(
      textoDoEnvelope({ modulos: { nucleo: { historicoDeAcoes: [semId] } } }),
      1,
    );
    if (leitura.ok) throw new Error('deveria ter reprovado');
    expect(leitura.erro.codigo).toBe('registroInvalido');
  });

  it('registro com deletedAt ausente (undefined, descartado pelo JSON.stringify) → registroInvalido', () => {
    const registroSemDeletedAt = {
      id: 'x',
      createdAt: REGISTRO_VALIDO.createdAt,
      updatedAt: REGISTRO_VALIDO.updatedAt,
      deletedAt: undefined,
    };
    // JSON.stringify descarta chaves com valor `undefined`: o texto final não
    // tem "deletedAt" nenhum, exatamente como o critério 10 pede.
    const textoDoRegistro = JSON.stringify(registroSemDeletedAt);
    expect(textoDoRegistro.includes('deletedAt')).toBe(false);

    const leitura = lerBackup(
      textoDoEnvelope({ modulos: { nucleo: { historicoDeAcoes: [registroSemDeletedAt] } } }),
      1,
    );
    if (leitura.ok) throw new Error('deveria ter reprovado');
    expect(leitura.erro.codigo).toBe('registroInvalido');
  });

  it('createdAt sem hora ("2026-09-22", só data de calendário) → registroInvalido', () => {
    const registro = { ...REGISTRO_VALIDO, createdAt: '2026-09-22' };
    const leitura = lerBackup(
      textoDoEnvelope({ modulos: { nucleo: { historicoDeAcoes: [registro] } } }),
      1,
    );
    if (leitura.ok) throw new Error('deveria ter reprovado');
    expect(leitura.erro.codigo).toBe('registroInvalido');
  });

  it('id duplicado na mesma tabela → registroInvalido', () => {
    const leitura = lerBackup(
      textoDoEnvelope({
        modulos: { nucleo: { historicoDeAcoes: [REGISTRO_VALIDO, { ...REGISTRO_VALIDO }] } },
      }),
      1,
    );
    if (leitura.ok) throw new Error('deveria ter reprovado');
    expect(leitura.erro.codigo).toBe('registroInvalido');
  });

  it('envelope válido → ok:true com o arquivo montado', () => {
    const leitura = lerBackup(
      textoDoEnvelope({ modulos: { nucleo: { historicoDeAcoes: [REGISTRO_VALIDO] } } }),
      1,
    );
    if (!leitura.ok) throw new Error(`deveria ter aprovado, mas reprovou: ${leitura.erro.codigo}`);
    expect(leitura.arquivo.metadados).toEqual(METADADOS_VALIDOS);
    expect(leitura.arquivo.modulos.nucleo).toEqual({ historicoDeAcoes: [REGISTRO_VALIDO] });
  });

  it('nunca lança: todo caminho de erro devolve { ok: false }, nunca uma exceção', () => {
    const entradasQuebradas = ['', '{', '[]', '"string"', 'null', '123'];
    for (const entrada of entradasQuebradas) {
      expect(() => lerBackup(entrada, 1)).not.toThrow();
    }
  });
});

describe('validarRegistrosDaTabela', () => {
  it('valor que não é array → lança estruturaInvalida', () => {
    expect(() => validarRegistrosDaTabela('nucleo', 'configuracoes', {})).toThrow(ErroDeBackup);
    try {
      validarRegistrosDaTabela('nucleo', 'configuracoes', {});
      throw new Error('deveria ter lançado');
    } catch (erro) {
      if (!ehErroDeBackup(erro)) throw erro;
      expect(erro.codigo).toBe('estruturaInvalida');
    }
  });

  it('lista de registros válidos é devolvida como está', () => {
    const registros = validarRegistrosDaTabela('nucleo', 'historicoDeAcoes', [REGISTRO_VALIDO]);
    expect(registros).toEqual([REGISTRO_VALIDO]);
  });

  it('id repetido lança registroInvalido', () => {
    try {
      validarRegistrosDaTabela('nucleo', 'historicoDeAcoes', [
        REGISTRO_VALIDO,
        { ...REGISTRO_VALIDO },
      ]);
      throw new Error('deveria ter lançado');
    } catch (erro) {
      if (!ehErroDeBackup(erro)) throw erro;
      expect(erro.codigo).toBe('registroInvalido');
    }
  });
});

describe('ehErroDeBackup', () => {
  it('reconhece uma instância de ErroDeBackup e rejeita qualquer outro erro', () => {
    const codigo: CodigoDeErroDeBackup = 'jsonInvalido';
    expect(ehErroDeBackup(new ErroDeBackup(codigo, 'detalhe de teste'))).toBe(true);
    expect(ehErroDeBackup(new Error('erro comum'))).toBe(false);
    expect(ehErroDeBackup('não é um erro')).toBe(false);
    expect(ehErroDeBackup(null)).toBe(false);
  });
});
