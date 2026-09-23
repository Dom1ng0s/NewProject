# 0009. Tela Hoje básica, navegação mínima e contrato dos cartões e atalhos

- Data: 2026-09-23
- Status: **aceita**. Sem pergunta bloqueante (ver "Pendências"); implementada e aprovada pelo `revisor` em 2026-09-23.

## Contexto

Item 0.11 do `docs/PLANO.md`: "Tela Hoje básica: layout com espaços para os cartões de cada pilar e botão de registro rápido".

O que a especificação e as decisões exigem:

| Onde | Exigência |
|---|---|
| Princípio 6 (seção 3) | Registro frequente (gasto, série, sessão de foco) em **no máximo 3 interações a partir da tela inicial** |
| Seção 6.4, "Tela Hoje" | Sem rolagem excessiva no celular: disponível para hoje, botão de iniciar foco, cards a revisar, treino previsto ou descanso, prazo mais urgente, **atalho de lançamento rápido para gasto, série e sessão** |
| Seção 8 | 360 px até desktop; WCAG 2.2 AA; **Hoje interativa em menos de 2 s**; textos centralizados |
| Seção 11 (DoD) | Offline, sobrevive ao fechamento, axe + teclado, coberto pelo backup, sem dependência que envie dados |
| D4 | Hoje existe desde a Fase 0; **cada fase termina com o cartão e o atalho do seu pilar na Hoje**; os 3 toques são testados a partir da Hoje desde a Fase 1 |
| D5 | XP derivado do histórico — mas gamificação é o item 5.2, não este |
| Pendência 5 | "3 interações" no gasto = abrir o lançamento, digitar o valor, tocar na categoria (que salva) |

O que já existe e **não se reabre**:

- **ADR 0002, seção 3:** `CartaoDeHoje { modulo, ordem, Componente }` em `src/modulos/nucleo/tipos.ts`; cada módulo exporta `cartaoDeHoje`; `src/app/modulos.ts` monta `cartoesDaHoje` (a Hoje recebe a lista **por prop**, o núcleo nunca importa um pilar). Os quatro componentes de cartão já existem como placeholders de uma linha (`Cartao{Nucleo,Treino,Estudos,Financas}.tsx`, só o título num `<p>`).
- **ADR 0006:** tela `/dados`. **ADR 0007, seção 4:** `AvisoDeAtualizacao` + `useAtualizacaoDoApp`, hoje renderizados em `App.tsx` acima das rotas; o ADR autoriza este item a mover o aviso para dentro do layout sem mudar o contrato. **ADR 0008:** tela `/configuracoes` (com link para `/dados`), tema por `data-tema`, `useAplicarTema()` em `App.tsx`.
- **ADR 0004:** portão do axe com as cinco etiquetas WCAG; `best-practice` ficou para ser reavaliada **neste item** (pendência 15). `@testing-library/react` foi adiada três vezes e a decisão final é **deste item** (pendências 14/58).
- `registrarAcao`/`listarAcoesDoPeriodo` existem (item 0.12).

Três fatos que mudam o desenho:

1. **No iPhone, um PWA instalado (`display: standalone`) não tem botão de voltar nem barra de endereço.** Hoje, quem entra em `/dados` ou `/configuracoes` pelo app instalado fica preso: só sai fechando o app. A navegação de volta não é enfeite, é requisito.
2. **Um botão único "Registrar" que abre um menu quebra o princípio 6 para o gasto.** Tocar "Registrar" + tocar "Gasto" + digitar o valor + tocar a categoria = **4** interações (pendência 5). O atalho precisa levar **direto** ao registro de cada tipo: são três atalhos, um por pilar, e não um botão com menu.
3. **Nenhum pilar tem dado nem tela.** Cartões e atalhos desta fase são necessariamente espaço reservado; o que se fecha aqui é a **moldura** e o **contrato** que cada fase preenche.

## Decisão

### 1. Moldura comum e navegação mínima

**Uma moldura (`src/app/layout/Moldura.tsx`) envolve todas as telas por uma rota de layout do React Router**, com `<Outlet />`:

```tsx
// src/app/rotas.tsx (forma, não código final)
<BrowserRouter>
  <Routes>
    <Route element={<Moldura />}>
      <Route path="/" element={<TelaHoje cartoes={cartoesDaHoje} atalhos={atalhosDeRegistro} />} />
      <Route path="/configuracoes" element={<TelaDeConfiguracoes />} />
      <Route path="/dados" element={<Dados contratos={contratosDeDados} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>
</BrowserRouter>
```

Estrutura da moldura, nesta ordem no DOM:

```html
<header class="cabecalho">
  <nav aria-label="Principal">
    <ul>
      <li><a href="/" aria-current="page">Hoje</a></li>
      <li><a href="/configuracoes">Configurações</a></li>
    </ul>
  </nav>
  <!-- AvisoDeAtualizacao, só quando haVersaoNova (seção 5) -->
</header>
<Outlet />  <!-- cada tela traz o seu próprio <main> com um único <h1> -->
```

- **Dois destinos só: Hoje e Configurações.** `/dados` continua sendo alcançado pelo link que já existe em Configurações (a especificação trata "Configurações e dados" como um lugar só, seção 6.4, e ADR 0008, seção 2). Três toques até "Exportar backup" (Configurações → Dados → Exportar) é aceitável para uma ação rara.
- Links com `NavLink` (que já põe `aria-current="page"` no destino atual). A marcação do atual **não é só cor**: o link atual fica em negrito e sublinhado grosso (`text-decoration-thickness`), os outros sem sublinhado.
- Cada link tem caixa de pelo menos 44 × 44 px (`display: inline-flex; min-height/min-width: var(--alvo-minimo)`).
- **Não aparece o nome do app** no cabeçalho: ainda é placeholder (pendência 8/9) e ocuparia a primeira linha da tela mais importante. O nome continua no `<title>` e no manifesto.
- **Cabeçalho no fluxo normal**, não fixo (`position: sticky/fixed` fica de fora): não cobre conteúdo com zoom de 200%, não disputa espaço com o teclado virtual e dispensa tratar a área segura do iPhone. **`index.html` não muda** (sem `viewport-fit=cover`): sem elemento fixo, o Safari já recua o conteúdo das bordas arredondadas sozinho.
- **Rota desconhecida volta para a Hoje** (`<Navigate to="/" replace />`), em vez de tela em branco — importante offline, onde o `navigateFallback` (ADR 0007) serve o app para qualquer caminho.
- **Sem barra de navegação inferior nesta fase.** Com dois destinos, uma barra de abas seria peso sem ganho. As telas dos pilares (Fases 1 a 4) são alcançadas **pelo cartão do pilar na Hoje** (o cartão contém o link "ver tudo" do pilar, seção 3.3). Se uma fase precisar de um terceiro destino permanente, ela propõe a mudança num ADR próprio — a moldura está num arquivo só.
- Uma tela futura que precise ocupar a tela inteira (ex.: treino em andamento) pode ficar fora da rota de layout. Consequência: nela, o aviso de versão nova não aparece — desejável durante um treino.

**Foco e rolagem ao trocar de tela.** O React Router não move foco nem volta a rolagem ao topo. Sem isso, tocar em "Backup, exportar e apagar dados" (no fim da tela de configurações) abre `/dados` já rolada para baixo, e o foco do teclado cai no `<body>` porque o link clicado deixou de existir. A moldura resolve com um efeito sobre `useLocation().pathname`:

- guarda o `pathname` anterior num `useRef`; se mudou (e **só** se mudou — nunca no primeiro carregamento, e à prova do efeito duplo do `StrictMode`), procura `document.querySelector<HTMLElement>('main h1')`, põe `tabIndex = -1` e chama `focus()`. O `focus()` também traz o título para a vista.
- O leitor de tela anuncia o título da tela nova; quem usa teclado continua do topo do conteúdo.

**Título da página por tela (WCAG 2.4.2, nível A).** Hoje todas as rotas têm o mesmo `<title>`. Um hook `useTituloDaPagina(titulo: string): void` em `src/ui/useTituloDaPagina.ts` faz `document.title = titulo` num efeito. Valores:

| Tela | `document.title` |
|---|---|
| Hoje | `NOME_DO_APP` (igual ao `<title>` estático; o e2e `app-carrega.spec.ts` continua valendo) |
| Configurações | `textos.comum.tituloDaPagina('Configurações')` → `Configurações · [NOME DO APP]` |
| Dados | `textos.comum.tituloDaPagina('Dados')` → `Dados · [NOME DO APP]` |

### 2. Layout da Hoje

Arquivo `src/modulos/nucleo/telas/Hoje.tsx`, componente **`TelaHoje`**, estilos em `Hoje.module.css`. Sem estado, sem efeito, **sem leitura de banco**.

```ts
export interface TelaHojeProps {
  readonly cartoes: readonly CartaoDeHoje[];
  readonly atalhos: readonly AtalhoDeRegistro[];
}
export function TelaHoje(props: TelaHojeProps): ReactElement;
```

Estrutura:

```html
<main class="pagina">
  <h1>Hoje</h1>

  <section class="registro">                 <!-- seção 4 -->
    <h2>Registrar agora</h2>
    <!-- atalhos.length > 0: <ul> com um link por atalho, ordenados por `ordem` -->
    <!-- atalhos.length === 0: <p> com textos.nucleo.hoje.registroRapido.vazio -->
  </section>

  <div class="cartoes">                        <!-- seção 3 -->
    <!-- um <section class="cartao"><h2>{titulo}</h2><Componente /></section> por cartão, ordenados por `ordem` -->
  </div>
</main>
```

- **Registro rápido primeiro, cartões depois.** O atalho é o que mais se usa e tem de estar visível sem rolar em 360 × 640 (princípio 6). Posição definitiva (inclusive uma barra fixa perto do polegar) é polimento do item 5.1.
- **Sem saudação e sem data.** A especificação não pede, e mostrar a data exige atualizá-la quando o app volta do segundo plano num dia seguinte (o iPhone mantém o PWA suspenso por horas). Esse mecanismo ("dia de hoje" reativo) nasce na primeira fase que precisa dele para um cálculo — Fase 1 (item 1.10, treino previsto) — e não aqui só para enfeite. Ver "Pendências".
- **Sem consultar o histórico.** Um "nada registrado hoje" seria enganoso (o único tipo de ação existente é `nucleo.configuracoesSalvas`, peso 0) e inventaria uma métrica da Fase 5.
- Layout: coluna única até 40 rem (mesma largura máxima de Configurações); acima disso, a área de cartões vira grade `repeat(auto-fill, minmax(18rem, 1fr))`. Cartão: `--cor-fundo-elevado`, borda `--cor-borda` de 1 px, `--raio`, padding `--espaco-4`. Sem sombra, sem animação.
- Ordenação: cópia da lista ordenada por `ordem` crescente (`[...cartoes].sort((a, b) => a.ordem - b.ordem)`); nunca muta a prop.
- Os `<section>` dos cartões e do registro **não** têm `aria-labelledby`: não viram landmarks (seriam seis regiões para o leitor de tela anunciar); a navegação por títulos (`h2`) já cobre.

### 3. Cartões dos pilares: placeholder e contrato para as fases

#### 3.1 Mudança no contrato `CartaoDeHoje`

A **Hoje** passa a desenhar a moldura de cada cartão (`<section>` + `<h2>` + estilo), e o módulo entrega só o conteúdo. Isso garante a mesma estrutura acessível e o mesmo visual nos quatro cartões, sem depender de cada fase lembrar. Para isso o contrato ganha o título:

```ts
// src/modulos/nucleo/tipos.ts
/** O cartão que o módulo mostra na tela Hoje (ADR 0002, seção 3; ADR 0009, seção 3). */
export interface CartaoDeHoje {
  readonly modulo: IdDeModulo;
  /** Posição na Hoje; menor aparece antes. Única entre os módulos. */
  readonly ordem: number;
  /** Texto do `<h2>` que a Hoje desenha acima do conteúdo. Vem do i18n do módulo. */
  readonly titulo: string;
  /** Só o CONTEÚDO do cartão: sem `<section>`, sem `<h2>`, sem `<main>`. Lê seus próprios dados por hook. */
  readonly Componente: ComponentType;
}
```

#### 3.2 Ordem e conteúdo nesta fase

A ordem segue a lista da seção 6.4 da especificação (disponível para hoje → foco e cards → treino → prazo), com o progresso (núcleo) no fim. O polimento definitivo é do item 5.1.

| Módulo | `ordem` | `titulo` | Conteúdo nesta fase (um `<p>`, cor `--cor-texto-suave`) | Quem substitui |
|---|---|---|---|---|
| `financas` | 1 | Finanças | "Em breve: quanto você ainda pode gastar hoje." | item 4.6 |
| `estudos` | 2 | Estudos | "Em breve: iniciar uma sessão de foco, os cards para revisar e o prazo mais urgente." | itens 2.6 e 3.6 |
| `treino` | 3 | Treino | "Em breve: o treino previsto na sua ficha ou o seu dia de descanso." | item 1.10 |
| `nucleo` | 4 | Seu progresso | "Em breve: sua evolução em estudos, finanças e treino." | item 5.2 (que decide se o cartão continua existindo) |

Nenhum cartão lê configuração, banco ou histórico nesta fase. O cartão de finanças **não** mostra "defina seu orçamento" agora (D11): isso depende da regra 7.3 e entra junto com ela no item 4.6.

#### 3.3 Regras que toda fase segue ao substituir o seu cartão

Entram no checklist do `revisor`/`revisor-critico` a partir da Fase 1:

1. **Só o conteúdo.** O `Componente` não renderiza `<section>`, `<h2>` nem `<main>`. Subtítulos internos usam `<h3>`.
2. **Sem estado de carregamento visível.** Leitura por hook exportado pelo próprio módulo, com `useLiveQuery(..., [], valorPadrao)` (padrão de `useConfiguracoes`): o cartão desenha na hora com o valor padrão e se atualiza quando o IndexedDB responde. Nada de spinner, nada de "Carregando...". O cartão reserva a altura do conteúdo final (`min-height`) para a Hoje não "pular".
3. **Consulta limitada.** Só leituras por índice num intervalo pequeno (hoje, a semana, o mês corrente, o próximo prazo). Nunca varrer uma tabela inteira nem o histórico inteiro na Hoje (seção 7).
4. **Nada de valor fixo** de meta, orçamento ou unidade (D4): lê `useConfiguracoes()`.
5. **Link para o pilar.** Se o pilar tem telas próprias, o cartão termina com um link para a tela principal do pilar (alvo de 44 × 44 px). É assim que as telas dos pilares são alcançadas (seção 1).
6. **O atalho de registro não mora no cartão**: vai para `atalhosDeRegistro` (seção 4). Ações específicas do cartão (ex.: "Revisar agora", "Iniciar foco") podem morar no cartão.
7. **Textos no i18n do próprio módulo**, sob `<modulo>.hoje.*`.
8. A entrega da fase **troca** o placeholder (e a chave `emBreve` do i18n), não acrescenta um segundo cartão.

### 4. Botão de registro rápido

**Decisão: a área "Registrar agora" existe desde já, renderiza a lista de atalhos que os módulos entregam, e nesta fase a lista é vazia — a área mostra um texto explicando o que vai aparecer ali. Nenhum botão desabilitado, nenhum atalho falso.**

Por quê:

- Pelo fato 2 do Contexto, o "botão de registro rápido" da especificação são **três atalhos diretos** (gasto, série, sessão). Um botão único com menu custaria um toque a mais e quebraria os 3 toques do gasto.
- Um botão desabilitado sem função é um controle morto: o leitor de tela anuncia "indisponível" sem dizer por quê, e o ADR 0006 (seção 7.2) já fixou a regra "texto, não botão desabilitado sem explicação".
- Apontar para Configurações ou Dados seria enganoso: não é registro.

Contrato novo, em `src/modulos/nucleo/tipos.ts`:

```ts
/**
 * Atalho de registro frequente na Hoje (princípio 6, D4). Um toque leva DIRETO
 * à tela de registro daquele tipo, já pronta para a primeira interação útil.
 */
export interface AtalhoDeRegistro {
  readonly modulo: IdDeModulo;
  /** Posição na área "Registrar agora"; menor aparece antes. */
  readonly ordem: number;
  /** Texto visível E nome acessível (ex.: 'Gasto'). Tem de fazer sentido sob o título "Registrar agora". */
  readonly rotulo: string;
  /** Rota interna do app (ex.: '/financas/novo-gasto'). Nunca URL externa. */
  readonly destino: string;
}
```

- Renderização: `<ul>` com um `<li>` por atalho, cada um um `<Link to={destino}>` com as classes de `Botao` primário (`botao botao--primario`), caixa ≥ 44 × 44 px, lado a lado em linha que quebra.
- `src/app/modulos.ts` ganha `export const atalhosDeRegistro: readonly AtalhoDeRegistro[] = [];`. A Fase 1 acrescenta `treino.atalhoDeRegistro` (item 1.10), a Fase 2 o de estudos (2.6), a Fase 4 o de finanças (4.6), exportados pelo `index.ts` de cada pilar com o nome `atalhoDeRegistro`.
- **Link para rota**, e não um componente livre: navegar por rota sobrevive ao fechamento do app (a URL diz onde o usuário estava), funciona com o foco da moldura (seção 1) e é testável. Se uma fase provar que precisa de outra forma (ex.: folha sobre a Hoje para caber nos 3 toques), ela muda este contrato num ADR próprio.
- A regra dos 3 toques passa a ser medida **a partir do toque no atalho** da Hoje (D4), no e2e de cada fase.

Texto do estado vazio (nesta fase): "Os atalhos para registrar um gasto, uma série de treino ou uma sessão de foco aparecem aqui assim que cada área estiver pronta." Quando o primeiro atalho existir (item 1.10), o texto some sozinho — a área mostra a lista.

### 5. Aviso de atualização: migra para a moldura

`useAtualizacaoDoApp()`, o estado `atualizando` e `<AvisoDeAtualizacao>` saem de `App.tsx` e vão para `Moldura.tsx`, **dentro do `<header>`, depois da `<nav>`**. Contratos de `AvisoDeAtualizacao` e `useAtualizacaoDoApp` **não mudam**; o comportamento do ADR 0007 (seção 4: não fixo, não modal, não move foco, "Depois" até a próxima abertura) continua idêntico.

Por quê: acima das rotas, o aviso fica **fora de qualquer landmark** — é exatamente a violação `region` que este ADR passa a cobrar (seção 7). Dentro do `<header>` (landmark `banner`), ele continua no topo da página, sem cobrir nada, e passa a existir em toda tela que usa a moldura. A moldura é montada uma vez pela rota de layout e não desmonta ao trocar de tela, então o registro do service worker continua acontecendo uma vez por abertura.

`App.tsx` fica só com `useAplicarTema()` e `<RotasDoApp />`.

### 6. `@testing-library/react`: decisão final — não instalar

**Não entra no projeto.** A pendência 14/58 fecha aqui; não volta a ser adiada.

- A Hoje desta fase não tem estado nem efeito: marcação pura, testável com `renderToStaticMarkup` (já usado em `AvisoDeAtualizacao.test.tsx`, `Campo.test.tsx`, `GrupoDeOpcoes.test.tsx`).
- O único comportamento novo (foco e rolagem na troca de rota, `aria-current`, título da página) é comportamento de navegador: o jsdom não faz layout nem rolagem, e o Playwright já cobre nos dois motores (D3).
- Política daqui em diante: **regra em função pura** (Vitest), **marcação** com `renderToStaticMarkup`, **comportamento** no e2e. Se uma fase tiver lógica de componente que o e2e não alcance de forma determinística (candidato: estados de timer do item 1.4/2.2), o ADR daquela fase propõe a biblioteca com justificativa — como dependência nova, não como pendência herdada.
- Consequência: `jsdom` continua instalado para testes que declaram `// @vitest-environment jsdom`; a lista fixa de dependências aprovadas de `e2e/pwa.spec.ts` não muda.

### 7. Acessibilidade

Mesmo padrão dos ADRs 0006 (seção 7.6) e 0008 (seção 11), mais:

- **Landmarks:** `banner` (`<header>`), `navigation` (`<nav aria-label="Principal">`), `main` (um por tela, trazido pela tela). Todo conteúdo visível dentro de um deles.
- **Um `<h1>` por tela**; hierarquia sem saltos (`h1` → `h2` → `h3`).
- **Promoção de `best-practice` ao portão do axe** (reavaliação prevista no ADR 0004, pendência 15): `e2e/utilitarios/acessibilidade.ts` passa a usar `[...ETIQUETAS_WCAG_AA, 'best-practice']`. Isso traz, entre outras, `landmark-one-main`, `page-has-heading-one`, `region`, `heading-order`, `landmark-unique` e `empty-heading`, e vale para **todas** as telas (Hoje, Configurações, Dados). Se alguma regra `best-practice` reprovar uma tela existente por motivo que não seja defeito real, o `testador` a desliga **individualmente** com `.disableRules([...])`, um comentário com o motivo, e registra no `docs/PLANO.md` — nunca tirando a etiqueta inteira.
- Alvo de 44 × 44 px: links da navegação, cada atalho (quando existir) e o link de cada cartão (quando existir).
- `prefers-reduced-motion`: nada anima; troca de tela instantânea.
- Nada só por cor: o destino atual da navegação tem peso e sublinhado, não só cor.
- A Hoje passa pelo axe **no tema claro e no escuro**, como Configurações.

### 8. Desempenho (a meta formal é do item 5.1/5.5)

O que este item **não** pode fazer, para não violar "Hoje interativa em menos de 2 s" depois:

- A `TelaHoje` e a moldura não fazem nenhuma leitura de banco, nenhum `await` antes de desenhar, e nenhum `import()` dinâmico.
- Nenhuma dependência nova.
- Regras 2 e 3 da seção 3.3 (sem carregamento visível, consulta limitada) valem para todo cartão futuro.
- **Linha de base:** a entrega registra no `docs/PLANO.md` o tamanho do JS de entrada (gzip) informado pelo `npm run build`, para o item 5.5 comparar. Não se cria orçamento de bundle automático agora.
- Separar `/dados` e `/configuracoes` em chunks por rota (`lazy`) fica para o item 5.5, se a medição pedir: hoje o ganho seria pequeno e cada chunk dinâmico precisa estar no precache (ADR 0007, seção 3).

### 9. Textos pt-BR

`src/i18n/pt-BR/comum.ts` (acrescenta):

```ts
navegacao: {
  rotulo: 'Principal',          // aria-label da <nav>
  hoje: 'Hoje',
  configuracoes: 'Configurações',
},
/** `Configurações · [NOME DO APP]`. A Hoje usa só NOME_DO_APP. */
tituloDaPagina: (tela: string) => `${tela} · ${NOME}`,   // NOME = o mesmo valor de nomeDoApp
```

`src/i18n/pt-BR/nucleo.ts`, bloco `hoje` substituído por:

```ts
hoje: {
  titulo: 'Hoje',
  tituloDoCartao: 'Seu progresso',
  emBreve: 'Em breve: sua evolução em estudos, finanças e treino.',
  registroRapido: {
    titulo: 'Registrar agora',
    vazio:
      'Os atalhos para registrar um gasto, uma série de treino ou uma sessão de foco aparecem aqui assim que cada área estiver pronta.',
  },
},
```

`linkParaDados` e `linkParaConfiguracoes` **saem** (a navegação vem de `comum.navegacao`; o link para Dados continua em `nucleo.configuracoes.dados.link`).

`treino.ts`, `estudos.ts`, `financas.ts`: `hoje.tituloDoCartao` mantido (`Treino`, `Estudos`, `Finanças`), mais `hoje.emBreve` com o texto da tabela 3.2.

`src/i18n/**` continua só com constantes e funções puras de texto (condição para `vite.config.ts` importá-lo, ADR 0007).

### 10. Quem faz o quê

| Agente | Arquivos |
|---|---|
| `dominio` | `src/modulos/nucleo/tipos.ts` (`titulo` em `CartaoDeHoje`; `AtalhoDeRegistro` novo, textos de comentário da seção 3.1/4); `src/modulos/{nucleo,treino,estudos,financas}/index.ts` (`titulo` e `ordem` da tabela 3.2; o núcleo exporta também `type AtalhoDeRegistro`, `TelaHoje` e `type TelaHojeProps`). **Nenhuma** mudança em schema, migração, repositório, histórico ou contrato de backup. |
| `interface` | `src/modulos/nucleo/telas/Hoje.tsx` + `Hoje.module.css` (novos); `src/modulos/*/componentes/Cartao*.tsx` (só o `<p>` de "em breve", sem título); `src/app/layout/Moldura.tsx` + `Moldura.module.css` (novos; apagar `src/app/layout/.gitkeep`); `src/app/App.tsx` (sai o aviso); `src/app/rotas.tsx` (rota de layout, `TelaHoje`, `*`; sai o placeholder `Hoje`); `src/app/modulos.ts` (`atalhosDeRegistro`); `src/ui/useTituloDaPagina.ts` + `src/ui/index.ts`; `TelaDeConfiguracoes` e `Dados` chamam `useTituloDaPagina`; `src/i18n/pt-BR/{comum,nucleo,treino,estudos,financas}.ts` |
| `testador` | `src/modulos/nucleo/telas/Hoje.test.tsx` (novo, `renderToStaticMarkup` dentro de `MemoryRouter`); `src/app/modulos.test.ts` (casos de `cartoesDaHoje`/`atalhosDeRegistro`); `e2e/hoje.spec.ts` (novo); `e2e/paginas/hoje.ts` (navegação pela `<nav>`; `navegarParaDados` passa por Configurações); `e2e/utilitarios/acessibilidade.ts` (`best-practice`); `e2e/acessibilidade.spec.ts` (Hoje no tema escuro); ajustes mínimos em `dados.spec.ts`, `configuracoes.spec.ts` e `pwa.spec.ts` só no que dependia do link antigo da Hoje |

Ordem: `dominio` e `interface` em paralelo (contrato fechado aqui; o `interface` depende só dos tipos da seção 3.1/4) → `testador` → **`revisor`** (tela, navegação e textos; não toca regra da seção 7, schema, persistência, backup nem privacidade).

### 11. Critérios de aceite do item 0.11

O item só está pronto quando todos passarem:

1. `npm run verificar` termina com código 0 e `npm run test:e2e` passa nos dois projetos (a suíte existente inclusive, sem teste pulado a mais).
2. **Nenhuma dependência nova:** `npm ls --depth=0` idêntico ao do item 0.10; `@testing-library/*` ausente. Nenhum `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` ou URL de terceiros em `src/`.
3. **Schema e backup intactos:** nenhum arquivo de `src/persistencia/**`, `src/modulos/*/repositorio/**` ou `src/modulos/nucleo/dominio/**` muda; `VERSAO_DO_SCHEMA` continua `1`.
4. **Fronteiras:** `Hoje.tsx` importa só de `../tipos` (relativo), `react`, `react-router`, `@/ui` e `@/i18n` — nenhum hook de dados, nenhum `@/persistencia`, nenhum pilar; `Moldura.tsx` não importa `@/persistencia` nem `dexie`; só `useAtualizacaoDoApp.ts` importa `virtual:pwa-register/react`; nenhum `eslint-disable` novo.
5. **Contrato dos cartões:** `cartoesDaHoje` tem 4 itens, um por `IdDeModulo`, com `ordem` únicas e `titulo` não vazio; ordenados por `ordem`, os módulos saem `financas`, `estudos`, `treino`, `nucleo`. `atalhosDeRegistro` é `[]`.
6. **Marcação da Hoje (unitário, `renderToStaticMarkup`):** com cartões falsos passados fora de ordem (`ordem` 3, 1, 2), os `<h2>` dos cartões aparecem na ordem 1, 2, 3, cada um dentro de um `<section>` junto do conteúdo do seu `Componente`, e a prop original não é mutada; existe exatamente um `<main>` e um `<h1>` com `nucleo.hoje.titulo`; com `atalhos: []` aparece o texto `registroRapido.vazio` e nenhum `<a>` na área de registro; com dois atalhos falsos (`ordem` 2 e 1), aparecem dois `<a>` com `href` igual ao `destino`, na ordem 1, 2, com o `rotulo` como texto, e o texto `vazio` some.
7. **E2e — Hoje (dois projetos):** abrir `/` mostra o `h1` "Hoje", o `h2` "Registrar agora" com o texto do estado vazio, e os quatro `h2` dos cartões na ordem Finanças, Estudos, Treino, Seu progresso, cada um com o seu texto "Em breve". Em 360 × 640 (viewport ajustado no teste), o `h2` "Registrar agora" está inteiro dentro da primeira tela, sem rolar.
8. **E2e — navegação de ida e volta (dois projetos), só por toque em link, sem `page.goto` nem `goBack`:** Hoje → Configurações (pela `<nav>`) → Dados (pelo link de Configurações) → Hoje (pela `<nav>`) → Configurações → Hoje. Em cada tela, o link do destino atual tem `aria-current="page"` e o outro não; `document.title` é `NOME_DO_APP` na Hoje, `Configurações · NOME_DO_APP` e `Dados · NOME_DO_APP` nas outras.
9. **E2e — foco e rolagem na troca de tela (dois projetos):** em Configurações, rolar até o fim e ativar o link para Dados **pelo teclado** (`Enter`): na tela Dados o elemento focado é o `h1` "Dados" e `window.scrollY` é tal que o `h1` está visível. No primeiro carregamento de `/`, o foco **não** é movido (o elemento ativo é o `<body>`).
10. **E2e — rota desconhecida:** abrir `/nao-existe` termina em `/` com a Hoje visível (nos dois projetos) e, com o app offline depois do primeiro carregamento, também (Chromium, pendência 10).
11. **E2e — aviso de atualização continua ausente à toa:** o critério 12 do ADR 0007 passa sem alteração em `/`, `/configuracoes` e `/dados`. Por leitura de código: o `<AvisoDeAtualizacao>` está dentro do `<header>` da moldura e não aparece mais em `App.tsx`.
12. **E2e — acessibilidade:** com o portão agora em `[...ETIQUETAS_WCAG_AA, 'best-practice']`, Hoje (tema claro **e** escuro), Configurações (claro e escuro) e Dados passam sem violação nos dois projetos; toda regra `best-practice` desligada está listada com motivo no `docs/PLANO.md`. Um teste percorre a Hoje só com teclado: `Tab` a partir do topo passa por "Hoje" e "Configurações" na `<nav>`, e `Enter` em "Configurações" abre a tela. Os dois links da `<nav>` têm caixa de pelo menos 44 × 44 px (`boundingBox()`).
13. **Offline:** o critério 7 do ADR 0007 continua passando, agora com a navegação Hoje → Configurações → Dados feita pelos links da moldura.
14. **Sem valor fixo e sem leitura na Hoje:** nenhum número de meta/orçamento/unidade em `Hoje.tsx`, `Moldura.tsx` ou nos `Cartao*.tsx`; nenhum deles chama `useConfiguracoes`, `useLiveQuery` ou `listarAcoesDoPeriodo` (busca no código, parte da revisão).
15. **Linha de base de desempenho** registrada no `docs/PLANO.md`: tamanho gzip do JS de entrada segundo o `npm run build`.
16. `docs/PLANO.md` atualizado (item 0.11 pronto, pendência 14/58 fechada como "não instalar", pendência 15 fechada com a promoção de `best-practice`, suposições registradas) e `git status` limpo depois do commit.

Definition of Done, aplicada a este item: **offline** — critérios 10 e 13; **sobrevive ao fechamento** — o item não grava nada (nenhuma escrita, nada a perder); **acessibilidade** — critério 12; **coberto pelo backup** — não cria dado (critério 3); **sem dependência que envie dados** — critério 2.

### 12. O que fica de fora do item 0.11

- Conteúdo real de qualquer cartão e qualquer atalho real — itens 1.10, 2.6, 3.6, 4.6 e 5.2.
- "Dia de hoje" reativo (data que vira à meia-noite e ao voltar do segundo plano) e exibição da data — item 1.10 (primeira necessidade real).
- Isolamento de falha por cartão (um cartão com erro não derruba a Hoje): exige um *error boundary*, que só faz sentido com o primeiro cartão que lê dados — o ADR do item 1.10 decide.
- Barra de navegação inferior, cabeçalho fixo, área segura do iPhone (`viewport-fit=cover`) — só se alguma fase criar elemento fixo.
- Onboarding (5.3), XP e níveis (5.2), aviso de backup (5.7), "sem rolagem excessiva" com conteúdo real e a meta de 2 s (5.1/5.5).
- Prints das telas — item 0.13 (a Hoje desta entrega é a primeira tela dele).

## Alternativas consideradas

- **Um botão único "Registrar" que abre um menu (gasto, série, sessão).** É o padrão "botão flutuante +" de muitos apps, mas custa um toque a mais e estoura os 3 toques do gasto (fato 2).
- **Três botões desabilitados "em breve" no lugar dos atalhos.** Satisfaria a letra do item com "um botão", mas coloca controles mortos na tela principal, contra a regra já fixada no ADR 0006 (seção 7.2), e obrigaria o contrato a aceitar atalho sem destino.
- **Atalho dentro do cartão de cada pilar**, sem área própria. Menos um contrato, mas os atalhos ficariam espalhados pela tela (o de treino, terceiro cartão, provavelmente abaixo da dobra), contra "atalho de lançamento rápido" como um elemento só da seção 6.4.
- **Atalho como componente livre (`Componente: ComponentType`)** em vez de rota. Mais flexível, mas cada fase inventaria a sua forma de abrir o registro, e o estado não sobreviveria ao fechamento do app. Fica como porta aberta via ADR, se uma fase provar que precisa.
- **Cada cartão desenha o próprio `<section>` e `<h2>`** (contrato atual, sem `titulo`). Nada muda no tipo, mas a estrutura acessível e o visual ficariam a cargo de quatro entregas diferentes.
- **Barra de navegação inferior (abas) já agora.** É o padrão de app de celular, mas com dois destinos seria só peso, e ainda exigiria tratar área segura e teclado virtual. Reavaliar quando existir um terceiro destino permanente.
- **Link "Voltar" em cada tela** em vez de navegação comum. Resolve o fato 1 com menos marcação, mas "voltar" depende de onde se veio (em Dados, voltar para Configurações ou para a Hoje?) e não serve a quem abre uma rota direto.
- **Três links na navegação (Hoje, Configurações, Dados).** Um toque a menos para o backup, que é ação rara; a especificação já trata os dois como um lugar só.
- **Mostrar data e saudação na Hoje.** Agradável, mas exige o "dia de hoje" reativo sem nenhum cálculo que dependa dele ainda; entra quando o primeiro cartão precisar.
- **Deixar o aviso de atualização em `App.tsx`.** Funciona, mas fica fora de qualquer landmark e reprova a regra `region` que este ADR promove.
- **Instalar `@testing-library/react`.** Pela quarta vez não há comportamento de componente que o jsdom reproduza melhor que o Playwright nos dois motores; a biblioteca seria peso sem uso.
- **Manter `best-practice` fora do portão.** O ADR 0004 adiou só até existir tela real; agora existem três, e as regras de estrutura (um `main`, um `h1`, conteúdo em landmark) são exatamente o que a moldura precisa garantir daqui em diante.
- **Focar o `<main>` (em vez do `<h1>`) na troca de tela**, ou anunciar a troca numa região viva. Focar o `h1` faz o leitor de tela ler o título da tela nova e dispensa uma região viva extra.

## Consequências

- **O app instalado deixa de ter beco sem saída:** de qualquer tela se volta à Hoje em um toque.
- **D4 ganha forma verificável:** cada fase preenche um cartão com título, conteúdo e (opcionalmente) link, e acrescenta um atalho numa lista. As regras da seção 3.3 viram checklist de revisão.
- **O contrato `CartaoDeHoje` muda** (campo `titulo`), mexendo nos quatro `index.ts`. É barato agora; depois da Fase 1 custaria mais.
- **A regra dos 3 toques passa a ter ponto de partida fixo:** o atalho na área "Registrar agora". O e2e de cada fase mede a partir dele.
- **O portão de acessibilidade fica mais rígido** (`best-practice`). Telas futuras precisam nascer com um `main`, um `h1` e todo conteúdo dentro de landmark; se alguma regra se mostrar ruidosa, ela é desligada uma a uma, com motivo.
- **`@testing-library/react` sai da pauta.** Comportamento de componente é testado no e2e; quem quiser a biblioteca precisa justificá-la num ADR de fase.
- **Na Fase 0 a Hoje mostra só "Em breve"** — é o que o usuário verá nos prints do relatório da Fase 0 (D6), não no produto final.
- **O aviso de versão nova só aparece em telas dentro da moldura.** Uma tela futura em tela cheia (treino em andamento) não o mostra — desejável, mas a entrega que criar essa tela precisa saber disso.

## Pendências

### Bloqueantes

Nenhuma.

### Não bloqueantes (suposições que seguem se não houver resposta)

1. **Registro rápido = três atalhos diretos** (gasto, série, sessão), um por pilar, e não um botão com menu (que custaria um quarto toque no gasto). Nesta fase a área mostra só um texto explicativo; o primeiro atalho real chega no item 1.10.
2. **Navegação com dois destinos (Hoje e Configurações)** num cabeçalho simples no topo de todas as telas; Dados continua dentro de Configurações; sem barra inferior. As telas dos pilares serão abertas pelo cartão de cada pilar na Hoje.
3. **Ordem dos cartões:** Finanças, Estudos, Treino, Seu progresso (segue a lista da seção 6.4). Ajuste fino no item 5.1.
4. **Sem data e sem saudação na Hoje** por enquanto; o "dia de hoje" reativo nasce no item 1.10.
5. **Aviso de versão nova passa para o cabeçalho**, com o mesmo comportamento.
6. **`@testing-library/react` não será instalada** (decisão final das pendências 14/58).
7. **Regras `best-practice` do axe entram no portão** para todas as telas (fecha a pendência 15); exceções só uma a uma, com motivo.
8. **Cada tela tem título de página próprio** (`Configurações · [NOME DO APP]`); a Hoje usa só o nome do app.
9. **Rota desconhecida leva para a Hoje**, em vez de tela em branco.
