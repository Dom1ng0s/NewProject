export const nucleo = {
  hoje: {
    tituloDoCartao: 'Núcleo',
    linkParaDados: 'Dados',
  },
  /** Textos da tela `/dados` (ADR 0006, seção 7.7). */
  dados: {
    titulo: 'Dados',
    introducao:
      'Seus dados ficam só neste dispositivo. Exporte um backup de vez em quando para não depender de um aparelho só.',
    arquivoSalvo: (nome: string) => `Arquivo salvo: ${nome}`,
    botaoSalvarArquivo: 'Salvar arquivo',
    salvandoArquivo: 'Salvando arquivo...',
    nomesDeModulo: {
      nucleo: 'Núcleo',
      treino: 'Treino',
      estudos: 'Estudos',
      financas: 'Finanças',
    },
    backup: {
      titulo: 'Backup completo (JSON)',
      ajuda:
        'Gera um arquivo com tudo: configurações, histórico e os dados de todos os módulos, inclusive itens que você excluiu. O arquivo não tem senha — guarde num lugar seguro.',
      botaoExportar: 'Exportar backup (JSON)',
      gerando: 'Gerando arquivo...',
    },
    csv: {
      titulo: 'CSV por módulo',
      ajuda:
        'O CSV serve para abrir numa planilha. Ele traz só os itens ativos; para restaurar o app, use o backup em JSON.',
      botaoPreparar: (modulo: string) => `Preparar CSV de ${modulo}`,
      preparando: 'Preparando...',
      botaoBaixar: (nomeDoArquivo: string) => `Baixar ${nomeDoArquivo}`,
      semDados: 'Sem dados para exportar ainda.',
    },
    importar: {
      titulo: 'Importar backup',
      aviso: 'Importar substitui todos os dados atuais por este arquivo. Não é possível desfazer.',
      rotuloArquivo: 'Escolher arquivo de backup (.json)',
      lendo: 'Lendo arquivo...',
      detalhesTecnicos: 'Detalhes técnicos',
      resumoTitulo: 'Resumo do arquivo',
      resumoGeradoEm: (dataEHora: string) => `Gerado em ${dataEHora}`,
      resumoTotalDeRegistros: (quantidade: number) => `${quantidade} registro(s) no total`,
      resumoModulo: (modulo: string, quantidade: number) => `${modulo}: ${quantidade} registro(s)`,
      botaoConfirmar: 'Importar e substituir',
      botaoCancelar: 'Cancelar',
      importando: 'Importando...',
      sucesso: 'Backup importado com sucesso.',
    },
    apagarTudo: {
      /** Texto do `<h2>`, do botão inicial e do `<h3>` da confirmação (todos iguais). */
      titulo: 'Apagar todos os dados',
      aviso:
        'Isto apaga definitivamente tudo que você registrou neste app: configurações, histórico e os dados de treino, estudos e finanças. Não é possível desfazer e não fica nenhuma cópia no aparelho. O app continua instalado e volta ao estado de primeiro uso.',
      dicaBackup: 'Exporte um backup antes de continuar.',
      rotuloConfirmacao: 'Para confirmar, digite APAGAR',
      dicaConfirmacao: 'O botão libera quando a palavra estiver correta.',
      botaoConfirmar: 'Apagar tudo agora',
      botaoCancelar: 'Cancelar',
      apagando: 'Apagando...',
      sucesso: 'Tudo apagado. O app voltou ao estado de primeiro uso.',
    },
    /** Uma mensagem por `CodigoDeErroDeBackup`, mais `falhaInesperada`. */
    erros: {
      jsonInvalido: 'Este arquivo não é um JSON válido.',
      naoEhBackup: 'Este arquivo não é um backup deste app.',
      formatoMaisNovo:
        'Este backup foi salvo num formato mais novo do que este app entende. Atualize o app e tente de novo.',
      formatoMaisAntigo: 'Este backup foi salvo num formato antigo que este app não lê mais.',
      schemaMaisNovo:
        'Este backup foi gerado por uma versão mais nova do app. Atualize o app e tente de novo.',
      schemaMaisAntigo:
        'Este backup foi gerado por uma versão anterior do app, que ainda não sabe ser convertida. Guarde o arquivo.',
      moduloDesconhecido: 'Este arquivo cita um módulo que este app não reconhece.',
      estruturaInvalida: 'A estrutura deste arquivo não é a de um backup válido.',
      registroInvalido: 'Um dos registros deste arquivo não tem a forma esperada.',
      falhaInesperada: 'Algo deu errado. Tente novamente.',
    },
  },
} as const;
