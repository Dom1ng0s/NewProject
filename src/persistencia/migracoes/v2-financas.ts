import type { Transaction } from 'dexie';
import { agoraEmIso, gerarIdentificador } from '@/compartilhado';
import type { Migracao } from './tipos';

/**
 * Categorias iniciais sensatas (`docs/ESPECIFICACAO.md`, §6.2): alimentação,
 * transporte, lazer, estudos, moradia, outros. Semeadas em `upgrade` (quem já
 * tinha o banco na v1) e em `popular` (banco criado do zero) — o Dexie não
 * roda `upgrade` de migração nenhuma quando o banco é novo (ver
 * `Migracao.popular`, `src/persistencia/migracoes/tipos.ts`).
 */
const NOMES_DAS_CATEGORIAS_INICIAIS = [
  'Alimentação',
  'Transporte',
  'Lazer',
  'Estudos',
  'Moradia',
  'Outros',
] as const;

async function semearCategoriasIniciais(transacao: Transaction): Promise<void> {
  const agora = agoraEmIso();
  const categorias = NOMES_DAS_CATEGORIAS_INICIAIS.map((nome) => ({
    id: gerarIdentificador(),
    createdAt: agora,
    updatedAt: agora,
    deletedAt: null,
    nome,
  }));
  await transacao.table('categorias').bulkAdd(categorias);
}

/**
 * Schema v2 (itens 1.1/1.2/1.6 do plano, Fase 1 — Finanças): cria de uma vez
 * as seis tabelas do pilar inteiro, para não precisar de uma v3 só de schema
 * mais adiante na mesma fase (`lancamentos` cobre gasto e entrada;
 * `assinaturas`/`usosDeAssinatura`/`cofrinhos`/`movimentosDeCofrinho` só
 * ganham tela nos itens 1.3 e 1.5 — aqui só o schema).
 *
 * Índices pensados no que a Hoje e as telas do pilar consultam: `data` (mês
 * corrente) e `categoriaId`/`assinaturaId` em `lancamentos`; `proximaCobranca`
 * em `assinaturas`; `assinaturaId`+`data` em `usosDeAssinatura`; `cofrinhoId`+
 * `data` em `movimentosDeCofrinho`. Soft delete (`deletedAt`) em todas —
 * nunca indexado (ADR 0005, seção 3.4).
 *
 * Migração publicada: nunca editar depois de alguém ter aberto o app com
 * ela. Corrigir um erro de schema é `v3`, nunca reescrever `v2Financas`.
 */
export const v2Financas: Migracao = {
  versao: 2,
  stores: {
    categorias: 'id, nome',
    lancamentos: 'id, data, categoriaId, assinaturaId, tipo',
    assinaturas: 'id, proximaCobranca',
    usosDeAssinatura: 'id, assinaturaId, data',
    cofrinhos: 'id',
    movimentosDeCofrinho: 'id, cofrinhoId, data',
  },
  upgrade: (transacao) => semearCategoriasIniciais(transacao),
  popular: (transacao) => semearCategoriasIniciais(transacao),
};
