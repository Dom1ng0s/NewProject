import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode, Ref } from 'react';
import {
  apagarTudo,
  ehErroDeBackup,
  exportarBackup,
  exportarCsvPorModulo,
  importarBackup,
  lerBackup,
  nomeDoArquivoCsv,
  nomeDoArquivoDeBackup,
  resumirBackup,
  serializarBackup,
  VERSAO_DO_SCHEMA,
} from '@/modulos/nucleo';
import type {
  ArquivoCsv,
  ArquivoDeBackup,
  ContratoDeDadosDeModulo,
  ErroDeBackup,
  IdDeModulo,
  ResumoDoBackup,
} from '@/modulos/nucleo';
import { hojeEmDataDeCalendario } from '@/compartilhado';
import { Aviso, Botao, Campo, lerTextoDeArquivo, salvarArquivo, useTituloDaPagina } from '@/ui';
import type { ArquivoParaSalvar, VarianteDoBotao } from '@/ui';
import { textos } from '@/i18n';
import estilos from './Dados.module.css';

const textosDeDados = textos.nucleo.dados;

export interface DadosProps {
  /**
   * Como o módulo do backup entra: `rotas.tsx` passa `contratosDeDados` de
   * `@/app/modulos` (ADR 0006, seção 7). Esta tela não importa `@/app/modulos`
   * nem `@/persistencia` — só orquestra o que o núcleo expõe.
   */
  readonly contratos: readonly ContratoDeDadosDeModulo[];
}

/** `AAAA-MM-DDTHH:mm:ssZ` → `dd/mm/aaaa às HH:mm`, só para exibição (não é regra de negócio). */
function formatarInstanteLocal(instanteIso: string): string {
  const instante = new Date(instanteIso);
  const doisDigitos = (valor: number) => valor.toString().padStart(2, '0');
  const dia = doisDigitos(instante.getDate());
  const mes = doisDigitos(instante.getMonth() + 1);
  const ano = instante.getFullYear();
  const hora = doisDigitos(instante.getHours());
  const minuto = doisDigitos(instante.getMinutes());
  return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
}

function nomeDoModulo(modulo: IdDeModulo): string {
  return textosDeDados.nomesDeModulo[modulo];
}

type FaseDeSalvar = 'ocioso' | 'gerando' | 'salvo' | 'precisaDeNovoToque' | 'erro';

interface BotaoDeArquivoProps {
  readonly rotulo: string;
  readonly rotuloGerando: string;
  readonly variante?: VarianteDoBotao;
  readonly montar: () => Promise<ArquivoParaSalvar>;
  /** Só usado quando este botão precisa receber o foco por código (ex.: primeiro item de uma lista recém-revelada). */
  readonly botaoRef?: Ref<HTMLButtonElement> | undefined;
}

/**
 * Botão que gera um arquivo e salva (ADR 0006, seção 7.5). Reusado pelo
 * backup em JSON e por cada CSV de módulo. Se o salvamento pedir um toque
 * novo (fato 2 do ADR — ativação transitória do `navigator.share`), o botão
 * vira "Salvar arquivo" e repete o salvamento com o conteúdo já em memória.
 */
function BotaoDeArquivo({
  rotulo,
  rotuloGerando,
  variante = 'primario',
  montar,
  botaoRef,
}: BotaoDeArquivoProps) {
  const [fase, setFase] = useState<FaseDeSalvar>('ocioso');
  const [nomeSalvo, setNomeSalvo] = useState<string | null>(null);
  const arquivoRef = useRef<ArquivoParaSalvar | null>(null);

  async function salvar(arquivo: ArquivoParaSalvar) {
    const resultado = await salvarArquivo(arquivo);
    if (resultado === 'salvo') {
      setNomeSalvo(arquivo.nome);
      setFase('salvo');
    } else if (resultado === 'cancelado') {
      setFase('ocioso');
    } else {
      setFase('precisaDeNovoToque');
    }
  }

  async function aoClicarGerar() {
    setFase('gerando');
    try {
      const arquivo = await montar();
      arquivoRef.current = arquivo;
      await salvar(arquivo);
    } catch {
      setFase('erro');
    }
  }

  async function aoClicarSalvarDeNovo() {
    const arquivo = arquivoRef.current;
    if (!arquivo) return;
    setFase('gerando');
    try {
      await salvar(arquivo);
    } catch {
      setFase('erro');
    }
  }

  return (
    <div>
      {fase === 'precisaDeNovoToque' ? (
        <Botao ref={botaoRef} variante={variante} onClick={() => void aoClicarSalvarDeNovo()}>
          {textosDeDados.botaoSalvarArquivo}
        </Botao>
      ) : (
        <Botao
          ref={botaoRef}
          variante={variante}
          aria-busy={fase === 'gerando'}
          onClick={() => void aoClicarGerar()}
        >
          {fase === 'gerando' ? rotuloGerando : rotulo}
        </Botao>
      )}
      {fase === 'salvo' && nomeSalvo ? (
        <Aviso variante="status">{textosDeDados.arquivoSalvo(nomeSalvo)}</Aviso>
      ) : null}
      {fase === 'erro' ? (
        <Aviso variante="alerta">{textosDeDados.erros.falhaInesperada}</Aviso>
      ) : null}
    </div>
  );
}

interface SecaoCsvDoModuloProps {
  readonly contrato: ContratoDeDadosDeModulo;
}

type EstadoCsv =
  | { readonly fase: 'ocioso' }
  | { readonly fase: 'preparando' }
  | { readonly fase: 'pronto'; readonly arquivos: readonly ArquivoCsv[] }
  | { readonly fase: 'erro' };

/** Uma subseção por módulo (ADR 0006, seção 7.2). */
function SecaoCsvDoModulo({ contrato }: SecaoCsvDoModuloProps) {
  const [estado, setEstado] = useState<EstadoCsv>({ fase: 'ocioso' });
  const rotulo = nomeDoModulo(contrato.modulo);
  const primeiroBotaoRef = useRef<HTMLButtonElement>(null);
  const semDadosRef = useRef<HTMLParagraphElement>(null);
  const erroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (estado.fase === 'pronto') {
      if (estado.arquivos.length > 0) {
        primeiroBotaoRef.current?.focus();
      } else {
        semDadosRef.current?.focus();
      }
    } else if (estado.fase === 'erro') {
      erroRef.current?.focus();
    }
  }, [estado]);

  async function preparar() {
    setEstado({ fase: 'preparando' });
    try {
      const resultado = await exportarCsvPorModulo([contrato]);
      const arquivos = resultado[0]?.arquivos ?? [];
      setEstado({ fase: 'pronto', arquivos });
    } catch {
      setEstado({ fase: 'erro' });
    }
  }

  return (
    <div className={estilos['subsecaoCsv']}>
      <h3>{rotulo}</h3>
      {estado.fase === 'ocioso' || estado.fase === 'preparando' ? (
        <Botao
          variante="secundario"
          aria-busy={estado.fase === 'preparando'}
          onClick={() => void preparar()}
        >
          {estado.fase === 'preparando'
            ? textosDeDados.csv.preparando
            : textosDeDados.csv.botaoPreparar(rotulo)}
        </Botao>
      ) : null}

      {estado.fase === 'pronto' && estado.arquivos.length === 0 ? (
        <p tabIndex={-1} ref={semDadosRef}>
          {textosDeDados.csv.semDados}
        </p>
      ) : null}

      {estado.fase === 'pronto' && estado.arquivos.length > 0 ? (
        <ul className={estilos['listaDeArquivos']}>
          {estado.arquivos.map((arquivo, indice) => {
            const nomeComData = nomeDoArquivoCsv(arquivo.nome, hojeEmDataDeCalendario());
            return (
              <li key={arquivo.nome}>
                <BotaoDeArquivo
                  variante="secundario"
                  rotulo={textosDeDados.csv.botaoBaixar(nomeComData)}
                  rotuloGerando={textosDeDados.salvandoArquivo}
                  botaoRef={indice === 0 ? primeiroBotaoRef : undefined}
                  montar={() =>
                    Promise.resolve({
                      nome: nomeComData,
                      tipoMime: 'text/csv;charset=utf-8',
                      conteudo: arquivo.conteudo,
                    })
                  }
                />
              </li>
            );
          })}
        </ul>
      ) : null}

      {estado.fase === 'erro' ? (
        <Aviso variante="alerta" ref={erroRef}>
          {textosDeDados.erros.falhaInesperada}
        </Aviso>
      ) : null}
    </div>
  );
}

type EstadoDeImportacao =
  | { readonly fase: 'ocioso' }
  | { readonly fase: 'lendo' }
  | {
      readonly fase: 'confirmando';
      readonly arquivo: ArquivoDeBackup;
      readonly resumo: ResumoDoBackup;
    }
  | {
      readonly fase: 'importando';
      readonly arquivo: ArquivoDeBackup;
      readonly resumo: ResumoDoBackup;
    }
  | { readonly fase: 'sucesso' }
  | { readonly fase: 'erro'; readonly erro: ErroDeBackup | null };

interface SecaoImportarProps {
  readonly contratos: readonly ContratoDeDadosDeModulo[];
}

/** Importar backup: dois passos — escolher arquivo, depois confirmar com o resumo à vista (ADR 0006, seção 7.3). */
function SecaoImportar({ contratos }: SecaoImportarProps) {
  const [estado, setEstado] = useState<EstadoDeImportacao>({ fase: 'ocioso' });
  const [chaveDoInput, setChaveDoInput] = useState(0);
  const mensagemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (estado.fase === 'sucesso' || estado.fase === 'erro') {
      mensagemRef.current?.focus();
    }
  }, [estado]);

  async function aoEscolherArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivoEscolhido = evento.target.files?.[0];
    if (!arquivoEscolhido) return;

    setEstado({ fase: 'lendo' });
    try {
      const texto = await lerTextoDeArquivo(arquivoEscolhido);
      const leitura = lerBackup(texto, VERSAO_DO_SCHEMA);
      if (leitura.ok) {
        setEstado({
          fase: 'confirmando',
          arquivo: leitura.arquivo,
          resumo: resumirBackup(leitura.arquivo),
        });
      } else {
        setEstado({ fase: 'erro', erro: leitura.erro });
      }
    } catch {
      setEstado({ fase: 'erro', erro: null });
    }
  }

  async function aoConfirmar() {
    if (estado.fase !== 'confirmando') return;
    const { arquivo, resumo } = estado;
    setEstado({ fase: 'importando', arquivo, resumo });
    try {
      await importarBackup(contratos, arquivo);
      setEstado({ fase: 'sucesso' });
      setChaveDoInput((chave) => chave + 1);
    } catch (erro) {
      setEstado({ fase: 'erro', erro: ehErroDeBackup(erro) ? erro : null });
    }
  }

  function aoCancelar() {
    setEstado({ fase: 'ocioso' });
    setChaveDoInput((chave) => chave + 1);
  }

  const estaOcupado = estado.fase === 'lendo' || estado.fase === 'importando';

  return (
    <>
      <p className={estilos['ajuda']}>{textosDeDados.importar.aviso}</p>
      <Campo
        key={chaveDoInput}
        id="dados-importar-arquivo"
        rotulo={textosDeDados.importar.rotuloArquivo}
        type="file"
        accept="application/json,.json"
        disabled={estaOcupado}
        aria-busy={estado.fase === 'lendo'}
        onChange={(evento) => void aoEscolherArquivo(evento)}
      />

      {estado.fase === 'lendo' ? <p aria-busy="true">{textosDeDados.importar.lendo}</p> : null}

      {estado.fase === 'erro' ? (
        <Aviso variante="alerta" ref={mensagemRef}>
          {estado.erro
            ? textosDeDados.erros[estado.erro.codigo]
            : textosDeDados.erros.falhaInesperada}
          {estado.erro ? (
            <details className={estilos['detalhesTecnicos']}>
              <summary>{textosDeDados.importar.detalhesTecnicos}</summary>
              <p>{estado.erro.detalhe}</p>
            </details>
          ) : null}
        </Aviso>
      ) : null}

      {estado.fase === 'confirmando' || estado.fase === 'importando' ? (
        <div className={estilos['resumo']}>
          <h3>{textosDeDados.importar.resumoTitulo}</h3>
          <p>
            {textosDeDados.importar.resumoGeradoEm(
              formatarInstanteLocal(estado.arquivo.metadados.geradoEm),
            )}
          </p>
          <p>{textosDeDados.importar.resumoTotalDeRegistros(estado.resumo.registros)}</p>
          <ul>
            {estado.resumo.modulos.map((modulo) => (
              <li key={modulo.modulo}>
                {textosDeDados.importar.resumoModulo(nomeDoModulo(modulo.modulo), modulo.registros)}
              </li>
            ))}
          </ul>
          <p className={estilos['ajuda']}>{textosDeDados.importar.aviso}</p>
          <div className={estilos['acoes']}>
            <Botao
              variante="destrutivo"
              aria-busy={estado.fase === 'importando'}
              disabled={estado.fase === 'importando'}
              onClick={() => void aoConfirmar()}
            >
              {estado.fase === 'importando'
                ? textosDeDados.importar.importando
                : textosDeDados.importar.botaoConfirmar}
            </Botao>
            <Botao
              variante="secundario"
              disabled={estado.fase === 'importando'}
              onClick={aoCancelar}
            >
              {textosDeDados.importar.botaoCancelar}
            </Botao>
          </div>
        </div>
      ) : null}

      {estado.fase === 'sucesso' ? (
        <Aviso variante="status" ref={mensagemRef}>
          {textosDeDados.importar.sucesso}
        </Aviso>
      ) : null}
    </>
  );
}

interface SecaoApagarTudoProps {
  readonly contratos: readonly ContratoDeDadosDeModulo[];
}

type EstadoDeApagar = 'inicial' | 'confirmando' | 'apagando' | 'concluido' | 'erro';

/** Apagar tudo: dois passos com palavra de confirmação (ADR 0006, seção 7.4). */
function SecaoApagarTudo({ contratos }: SecaoApagarTudoProps) {
  const [estado, setEstado] = useState<EstadoDeApagar>('inicial');
  const [palavra, setPalavra] = useState('');
  const tituloDaConfirmacaoRef = useRef<HTMLHeadingElement>(null);
  const mensagemFinalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (estado === 'confirmando') {
      tituloDaConfirmacaoRef.current?.focus();
    }
    if (estado === 'concluido') {
      mensagemFinalRef.current?.focus();
    }
  }, [estado]);

  const podeConfirmar = palavra.trim().toUpperCase() === 'APAGAR';

  async function aoConfirmar() {
    setEstado('apagando');
    try {
      await apagarTudo(contratos);
      setEstado('concluido');
    } catch {
      setEstado('erro');
    }
  }

  function aoCancelar() {
    setEstado('inicial');
    setPalavra('');
  }

  return (
    <>
      {estado === 'inicial' ? (
        <Botao variante="destrutivo" onClick={() => setEstado('confirmando')}>
          {textosDeDados.apagarTudo.titulo}
        </Botao>
      ) : null}

      {estado === 'confirmando' || estado === 'apagando' || estado === 'erro' ? (
        <div className={estilos['areaDeConfirmacao']}>
          <h3 tabIndex={-1} ref={tituloDaConfirmacaoRef}>
            {textosDeDados.apagarTudo.titulo}
          </h3>
          <p>{textosDeDados.apagarTudo.aviso}</p>
          <p>{textosDeDados.apagarTudo.dicaBackup}</p>
          <Campo
            id="dados-apagar-confirmacao"
            rotulo={textosDeDados.apagarTudo.rotuloConfirmacao}
            dica={textosDeDados.apagarTudo.dicaConfirmacao}
            value={palavra}
            autoComplete="off"
            disabled={estado === 'apagando'}
            onChange={(evento) => setPalavra(evento.target.value)}
          />
          {estado === 'erro' ? (
            <Aviso variante="alerta">{textosDeDados.erros.falhaInesperada}</Aviso>
          ) : null}
          <div className={estilos['acoes']}>
            <Botao
              variante="destrutivo"
              disabled={!podeConfirmar || estado === 'apagando'}
              aria-busy={estado === 'apagando'}
              onClick={() => void aoConfirmar()}
            >
              {estado === 'apagando'
                ? textosDeDados.apagarTudo.apagando
                : textosDeDados.apagarTudo.botaoConfirmar}
            </Botao>
            <Botao variante="secundario" disabled={estado === 'apagando'} onClick={aoCancelar}>
              {textosDeDados.apagarTudo.botaoCancelar}
            </Botao>
          </div>
        </div>
      ) : null}

      {estado === 'concluido' ? (
        <Aviso variante="status" ref={mensagemFinalRef}>
          {textosDeDados.apagarTudo.sucesso}
        </Aviso>
      ) : null}
    </>
  );
}

function Secao({ titulo, children }: { readonly titulo: string; readonly children: ReactNode }) {
  return (
    <section className={estilos['secao']}>
      <h2>{titulo}</h2>
      {children}
    </section>
  );
}

export function Dados({ contratos }: DadosProps) {
  useTituloDaPagina(textos.comum.tituloDaPagina('Dados'));
  return (
    <main className={estilos['pagina']}>
      <h1>{textosDeDados.titulo}</h1>
      <p className={estilos['introducao']}>{textosDeDados.introducao}</p>

      <Secao titulo={textosDeDados.backup.titulo}>
        <p className={estilos['ajuda']}>{textosDeDados.backup.ajuda}</p>
        <BotaoDeArquivo
          rotulo={textosDeDados.backup.botaoExportar}
          rotuloGerando={textosDeDados.backup.gerando}
          montar={async () => {
            const arquivo = await exportarBackup(contratos);
            return {
              nome: nomeDoArquivoDeBackup(hojeEmDataDeCalendario()),
              tipoMime: 'application/json',
              conteudo: serializarBackup(arquivo),
            };
          }}
        />
      </Secao>

      <Secao titulo={textosDeDados.csv.titulo}>
        <p className={estilos['ajuda']}>{textosDeDados.csv.ajuda}</p>
        {contratos.map((contrato) => (
          <SecaoCsvDoModulo key={contrato.modulo} contrato={contrato} />
        ))}
      </Secao>

      <Secao titulo={textosDeDados.importar.titulo}>
        <SecaoImportar contratos={contratos} />
      </Secao>

      <Secao titulo={textosDeDados.apagarTudo.titulo}>
        <SecaoApagarTudo contratos={contratos} />
      </Secao>
    </main>
  );
}
