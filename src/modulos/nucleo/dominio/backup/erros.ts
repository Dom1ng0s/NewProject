/**
 * Erro único de todo o caminho de backup (ADR 0006, seção 2.2): a leitura
 * pura (`lerBackup`) devolve uma instância dentro de `LeituraDeBackup`, e as
 * implementações de `importarJson` de cada módulo a LANÇAM — o que desfaz a
 * transação inteira (ADR 0006, seção 5).
 */
export type CodigoDeErroDeBackup =
  | 'jsonInvalido' // JSON.parse falhou
  | 'naoEhBackup' // sem envelope, ou metadados.formato diferente
  | 'formatoMaisNovo' // versaoDoFormato > VERSAO_DO_FORMATO_DE_BACKUP
  | 'formatoMaisAntigo' // versaoDoFormato < VERSAO_DO_FORMATO_DE_BACKUP
  | 'schemaMaisNovo' // versaoDoSchema > VERSAO_DO_SCHEMA do app
  | 'schemaMaisAntigo' // versaoDoSchema < VERSAO_DO_SCHEMA do app
  | 'moduloDesconhecido' // chave de modulo fora de IdDeModulo
  | 'estruturaInvalida' // modulos/tabela nao e objeto/array
  | 'registroInvalido'; // registro sem a forma de RegistroBase ou invalido para a tabela

/**
 * `detalhe` é texto de desenvolvedor e pode citar nome de módulo, de tabela,
 * de campo e índice na lista — NUNCA o valor de um campo do usuário. É
 * exibido num bloco "detalhes técnicos" da tela, e essa regra é o que torna
 * isso seguro.
 */
export class ErroDeBackup extends Error {
  readonly codigo: CodigoDeErroDeBackup;
  readonly detalhe: string;

  constructor(codigo: CodigoDeErroDeBackup, detalhe: string) {
    super(`${codigo}: ${detalhe}`);
    this.name = 'ErroDeBackup';
    this.codigo = codigo;
    this.detalhe = detalhe;
  }
}

export function ehErroDeBackup(erro: unknown): erro is ErroDeBackup {
  return erro instanceof ErroDeBackup;
}
