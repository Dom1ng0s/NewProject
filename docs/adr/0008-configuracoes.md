# 0008. Tela de configurações: metas, orçamento, unidade de peso e tema

- Data: 2026-09-23
- Status: **aceita**. Sem pergunta bloqueante (ver "Pendências"); implementada e aprovada pelo `revisor-critico` em 2026-09-23.

## Contexto

Item 0.10 do `docs/PLANO.md`: "Tela de configurações: metas semanais de foco e treino, orçamento mensal, unidades (kg/lb), tema".

O que a especificação e as decisões exigem:

| Onde | Exigência |
|---|---|
| Seção 5 | Peso em kg por padrão, com opção de lb; dinheiro em **centavos inteiros**; regras puras separadas da interface |
| Seção 6.4 | Metas semanais de foco e de treino, orçamento mensal, unidades; **tema claro e escuro, seguindo o sistema por padrão** |
| Seção 8 | WCAG 2.2 AA (contraste, teclado, rótulos, alvo 44 × 44 px, `prefers-reduced-motion`); moeda `R$ 1.234,56`; resposta visual < 100 ms; textos centralizados; nenhuma perda por fechamento inesperado |
| Seção 11 (DoD) | Offline, sobrevive ao fechamento, axe + teclado, coberta pelo backup, nenhuma dependência que envie dados |
| D4 | A tela de configurações existe desde a Fase 0; regras leem as configurações, nunca valor fixo |
| D11 | Padrões: 10 h de foco/semana, 3 treinos/semana, kg, tema do sistema, orçamento `null` |

O que já existe e **não se reabre**:

- **Schema de `Configuracoes`** (ADR 0005, seção 3.1), em `src/modulos/nucleo/dominio/configuracoes.ts`: `metaSemanalDeFocoEmMinutos: number`, `metaSemanalDeTreinos: number`, `orcamentoMensalEmCentavos: number | null`, `unidadeDePeso: 'kg' | 'lb'`, `tema: 'sistema' | 'claro' | 'escuro'`, `onboardingConcluidoEm: string | null`. `CONFIGURACOES_PADRAO`, `validarConfiguracoes` (devolve `string[]`), `aplicarMudancas`. **Este item não muda o schema, não cria migração e não muda o contrato de backup** (ADR 0006, seção 4.3).
- **Repositório:** `obterConfiguracoes()`, `salvarConfiguracoes(mudancas: Partial<Configuracoes>)` (mescla sobre o que existe, valida, grava a linha sentinela e a ação `nucleo.configuracoesSalvas` na mesma transação, lança se inválido) e `useConfiguracoes()` (`useLiveQuery` com padrão `CONFIGURACOES_PADRAO`, nunca `undefined`). Tudo exportado por `@/modulos/nucleo`.
- **Pendência 21:** cada `salvarConfiguracoes` grava uma ação no histórico (peso 0 no XP). **Pendência 22:** orçamento é valor único. **Pendência 23:** grandezas com fração viram inteiro na menor unidade; `unidadeDePeso` é só exibição.
- **UI:** `Botao`, `Campo` (rótulo + input + dica), `Aviso` em `src/ui/`; tokens em `src/app/estilos/tokens.css`, com o tema escuro hoje decidido **só** por `@media (prefers-color-scheme: dark)`; classes dos componentes em `global.css`.
- **Rotas:** `src/app/rotas.tsx` tem a Hoje placeholder (`<p>Hoje <Link to="/dados">Dados</Link></p>`) e a rota `/dados`. A navegação de verdade é do item 0.11.
- **ADR 0007, seção 2:** as cores `#ffffff`/`#121212` estão duplicadas em `tokens.css`, nas duas metas `theme-color` do `index.html` (com `media`) e no manifesto; a decisão sobre `theme-color` seguir o tema manual foi deixada para este item (pendência 48 do plano).
- **Pendência 14:** `@testing-library/react` foi adiada para "0.10/0.11".

## Decisão

### 1. Rota, nome e lugar

- Rota **`/configuracoes`**, em `src/app/rotas.tsx`, sem props (a tela não precisa de `contratosDeDados`).
- Arquivo `src/modulos/nucleo/telas/Configuracoes.tsx`, componente **`TelaDeConfiguracoes`**. Não se chama `Configuracoes` porque `@/modulos/nucleo` já exporta o **tipo** `Configuracoes`; um valor e um tipo com o mesmo nome no mesmo `index.ts` compila, mas confunde quem lê. Estilos em `Configuracoes.module.css`.
- **É a mesma tela sempre.** Não existe modo "primeiro uso": o onboarding (item 5.3) é um fluxo à parte que poderá reaproveitar os mesmos campos. A tela pode ser reaberta a qualquer momento e **nunca lê nem grava `onboardingConcluidoEm`**.

### 2. Layout

`<main>` com `<h1>Configurações</h1>`, uma região de status (seção 4) e cinco `<section>` com `<h2>`, nesta ordem:

| Seção (`<h2>`) | Controle | Grava em |
|---|---|---|
| Metas da semana | `Campo` "Horas de foco por semana" | `metaSemanalDeFocoEmMinutos` |
| | `Campo` "Treinos por semana" | `metaSemanalDeTreinos` |
| Orçamento | `Campo` "Orçamento do mês (R$)" | `orcamentoMensalEmCentavos` |
| Unidades | `GrupoDeOpcoes` "Unidade de peso": Quilogramas (kg) · Libras (lb) | `unidadeDePeso` |
| Aparência | `GrupoDeOpcoes` "Tema": Seguir o sistema · Claro · Escuro | `tema` |
| Dados | link "Backup, exportar e apagar dados" para `/dados` | — |

A seção "Dados" existe porque a seção 6.4 da especificação trata "Configurações e dados" como um só lugar; é um link, não uma cópia da tela `/dados`.

### 3. Entrada de cada campo

Todos os campos de número são **`<input type="text">`** com `inputMode`, e não `type="number"`: no iPhone em pt-BR o `type="number"` mistura vírgula e ponto, aceita `e`, e devolve `''` sem dizer por quê. Sem máscara, sem biblioteca nova. `autoComplete="off"` e `enterKeyHint="done"` em todos.

**3.1 Meta de foco — em horas, com no máximo uma casa decimal.** O usuário pensa "10 horas por semana", não "600 minutos". Uma casa decimal (`7,5`) basta para meia hora e, com ela, a conversão é **exata**: `h,d` horas = `h × 60 + d × 6` minutos, sempre inteiro. Duas casas (`7,25`) seriam rejeitadas com mensagem de formato. `inputMode="decimal"`. Exibição do valor gravado: `formatarMinutosEmHoras(600) === '10'`, `(450) === '7,5'`. Um valor gravado que não é múltiplo de 6 minutos (só chega por importação de backup) é exibido arredondado a uma casa (`605` → `'10,1'`); ele **não é regravado** a menos que o usuário edite o texto (regra 3.5), então nada se perde.

**3.2 Meta de treinos — número inteiro.** `inputMode="numeric"`.

**3.3 Orçamento — reais, gravado em centavos.** `inputMode="decimal"`. O campo mostra o valor gravado como `formatarReais(centavos)` (ex.: `1.500,00`, sem `R$`, que está no rótulo); `null` mostra o campo vazio com a dica "Deixe em branco para não usar orçamento. Sem orçamento, a tela Hoje não calcula quanto você pode gastar." **Apagar o texto e confirmar grava `null`** (D11). Formatos aceitos por `lerCentavosDeReais`, com testes para cada um:

| Texto | Centavos | Motivo |
|---|---|---|
| `1500` | `150000` | inteiro |
| `1500,5` / `1500,50` | `150050` | vírgula decimal, 1 ou 2 casas |
| `1.500` / `1.500,00` | `150000` | ponto como separador de milhar pt-BR (grupos de 3) |
| `12.5` / `12.50` | `1250` | ponto seguido de 1–2 dígitos no fim e sem vírgula = decimal (teclado de Android em inglês) |
| `R$ 1.500,00`, `  1500 ` | `150000` | `R$` e espaços são ignorados |
| `-10` | `-1000` | o sinal é lido; quem recusa negativo é o domínio (seção 4) |
| `1.2345`, `1,234`, `1.50.0`, `abc`, `,5`, `1e3` | inválido | formato não reconhecido |

A conversão é feita **sobre o texto** (parte inteira e parte decimal como dígitos), nunca com `parseFloat(...) * 100`, que produz `1234.5599999` e reintroduz ponto flutuante (seção 5 da especificação). Resultado acima de `Number.MAX_SAFE_INTEGER` é inválido.

**3.4 Unidade de peso e tema — `GrupoDeOpcoes` (rádios).** Duas ou três opções visíveis, **um toque** para trocar (um `<select>` exigiria dois). Salva no `change`, sem botão.

**3.5 Quando salva: automático, por campo, na confirmação.** Não há botão "Salvar".

- Rádio: salva no `change`.
- Texto: salva ao **confirmar** o campo — `blur`, tecla `Enter`, ou a página ficar oculta (`visibilitychange` com `document.visibilityState === 'hidden'`, que cobre fechar o app com o teclado aberto; `blur` sozinho não dispara de forma confiável no iPhone nesse caso).
- **Só salva se o texto mudou** em relação ao que estava exibido quando o campo foi preenchido. Tocar num campo e sair não grava nada — e, portanto, não cria ação no histórico (pendência 21) nem regrava um valor arredondado (3.1).
- Motivo: um botão "Salvar" único é um toque a mais e abre o caso "saí da tela sem salvar", que pediria aviso de alteração pendente. Salvar por campo é o padrão de tela de ajustes em celular e cabe no princípio de poucos toques. Custo aceito: uma ação `nucleo.configuracoesSalvas` por campo alterado, com peso 0.
- Cada gravação chama `salvarConfiguracoes({ <campo>: valor })` com **só** o campo confirmado: dois campos confirmados em sequência rápida não se sobrescrevem, porque o repositório mescla dentro da transação.

**3.6 Estado local e sincronização.**

- Campo de texto: guarda o texto digitado em estado local. Enquanto o campo **tem foco ou tem texto não confirmado**, a tela não o sobrescreve. Fora disso, quando `useConfiguracoes()` muda (primeira leitura do banco, importação de backup noutra aba), o texto é reescrito a partir do valor gravado. Isso também resolve o primeiro render, em que `useConfiguracoes()` ainda devolve o padrão.
- Rádio: atualização otimista — marca na hora (resposta < 100 ms sem esperar o IndexedDB) e salva; se `salvarConfiguracoes` rejeitar, volta ao valor anterior e mostra o erro.

### 4. Validação: formato na borda, regra no domínio

Duas etapas, com dono claro, sem repetir regra na tela:

1. **Formato (texto → número).** Funções puras em `src/compartilhado/` (seção 7). Devolvem o número ou `null` se o texto não é um número naquele formato. **Aceitam sinal negativo**: dizer se negativo é permitido é regra, não formato.
2. **Regra (número → válido?).** O domínio. A tela monta o candidato com `aplicarMudancas(atuais, { campo: valor })` e chama `problemasDeConfiguracoes(candidato)` (nova, seção 6), filtrando pelo campo editado. Só com lista vazia chama `salvarConfiguracoes`. O repositório valida de novo dentro da transação — é a garantia final; a checagem na tela serve para mostrar a mensagem certa no campo certo antes de abrir transação.

Para isso o domínio passa a devolver problemas **estruturados**, sem mudar o que já existe:

```ts
// src/modulos/nucleo/dominio/configuracoes.ts
export type CampoNumericoDeConfiguracoes =
  | 'metaSemanalDeFocoEmMinutos'
  | 'metaSemanalDeTreinos'
  | 'orcamentoMensalEmCentavos';

export interface ProblemaDeConfiguracoes {
  readonly campo: CampoNumericoDeConfiguracoes;
  readonly codigo: 'naoEhInteiro' | 'negativo';
  /** Texto de desenvolvedor, igual ao que `validarConfiguracoes` ja devolve hoje. */
  readonly mensagem: string;
}

/** Fonte unica das regras. Lista vazia = valido. */
export function problemasDeConfiguracoes(
  configuracoes: Configuracoes,
): readonly ProblemaDeConfiguracoes[];

/** Inalterada por fora: `problemasDeConfiguracoes(c).map((p) => p.mensagem)`. */
export function validarConfiguracoes(configuracoes: Configuracoes): string[];
```

As mensagens continuam **exatamente** as de hoje (os testes existentes com `toContain` seguem passando sem edição), e `repositorio/configuracoes.ts` e `repositorio/contrato-de-dados.ts` não mudam. Um valor não inteiro gera `naoEhInteiro`; inteiro menor que zero gera `negativo` (um problema por campo, como hoje).

`unidadeDePeso` e `tema` não entram: a tela só oferece os literais da união, e a importação já valida as uniões (ADR 0006, seção 4.3).

**Sem limite superior** nas metas nem no orçamento (o domínio não tem, e inventar um agora mudaria também a validação da importação). Ver "Pendências".

**Como a tela mostra o erro:**

- `Campo` ganha a prop opcional `erro?: string` (seção 8.1). Com ela presente, o campo recebe `aria-invalid="true"` quando `erro !== ''`, e a mensagem aparece abaixo do campo em texto (não só cor), ligada por `aria-describedby`, dentro de um elemento `role="alert"` que **já existe no DOM vazio** antes do primeiro erro — região viva montada já com conteúdo às vezes não é anunciada (observação do `revisor-critico` no item 0.7).
- O texto digitado **fica no campo** para o usuário corrigir; nada é gravado. O foco **não** é puxado de volta (seria armadilha de foco no `blur`).
- Mapeamento para texto (interface): formato inválido → mensagem de formato do campo; `negativo` → mensagem de negativo do campo; `naoEhInteiro` (não alcançável pela tela, porque o formato já garante inteiro) → mensagem de formato; exceção de `salvarConfiguracoes` → `falhaAoSalvar`. Corrigir o texto e confirmar limpa o erro.

### 5. Feedback de sucesso

Uma região **`<p role="status" aria-live="polite">`** logo abaixo do `<h1>`, **sempre montada** (vazia no início). Cada gravação bem-sucedida troca o texto: "Meta de foco salva.", "Meta de treinos salva.", "Orçamento salvo.", "Orçamento removido." (quando vira `null`), "Unidade de peso salva.", "Tema salvo." O foco não se move: o usuário segue para o próximo campo. Nenhuma animação.

### 6. Tema: como a escolha se aplica

**Decisão: atributo `data-tema` no `<html>`, sempre com o tema já resolvido (`claro` ou `escuro`), e os tokens escuros escritos uma única vez.**

`tokens.css` passa a ser:

```css
:root {                       /* tema claro: como hoje */
  color-scheme: light;
  --cor-fundo: #ffffff;
  /* ...demais tokens claros e os de espaçamento, sem mudança... */
}

:root[data-tema='escuro'] {   /* o mesmo bloco que hoje está dentro do @media */
  color-scheme: dark;
  --cor-fundo: #121212;
  /* ...demais tokens escuros, sem mudança de valor... */
}
```

O `@media (prefers-color-scheme: dark)` **sai do CSS**. Quem decide o tema é um único ponto em JavaScript, em dois momentos:

1. **Antes da primeira pintura** — um `<script>` clássico de uma linha no `<head>` do `index.html` resolve pelo sistema e evita o clarão branco para quem usa o celular no escuro (o módulo do React roda depois da primeira pintura):

   ```html
   <script>document.documentElement.dataset.tema = matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';</script>
   ```

2. **Depois de ler a configuração** — o hook `useAplicarTema()` em `src/app/tema/useAplicarTema.ts`, chamado uma vez em `App.tsx` (acima das rotas, vale para todas as telas):
   - lê `useConfiguracoes().tema`;
   - resolve com `resolverTema(tema, sistemaEscuro)` (pura, seção 7);
   - grava `document.documentElement.dataset.tema`;
   - com `tema === 'sistema'`, escuta `change` de `matchMedia('(prefers-color-scheme: dark)')` e reaplica; remove o ouvinte ao trocar de tema ou desmontar;
   - atualiza as **duas** metas `theme-color` com o valor calculado de `--cor-fundo` (`getComputedStyle(document.documentElement).getPropertyValue('--cor-fundo')`), para que a barra de status e a barra do navegador acompanhem o tema escolhido — sem uma terceira cópia das cores.

Consequências registradas:

- Com tema manual diferente do sistema, há uma troca visível **de alguns milissegundos** na abertura (o tempo de ler o IndexedDB). Não se espelha o tema em `localStorage` para evitar isso: seria um segundo armazenamento fora do backup e das transações, e o ADR 0005 já recusou `localStorage` para configurações.
- **O manifesto continua `#ffffff`** (`background_color`/`theme_color`): é estático, não tem como seguir a configuração. A tela de abertura no Android segue branca (pendência 48 continua valendo); dentro do app, a meta `theme-color` passa a acompanhar o tema escolhido.
- As metas `theme-color` do `index.html` ficam como estão (com `media`): valem para o instante antes do JavaScript.
- Todas as telas passam a depender do atributo: sem JavaScript não há app (React), então não existe caso "sem atributo" real — mesmo assim, sem atributo o CSS cai no tema claro, que é legível.

### 7. Funções puras novas em `src/compartilhado/`

Genéricas, sem domínio, sem DOM. São do agente `dominio` e reaproveitáveis: `lerCentavosDeReais` é a mesma entrada do gasto em 3 toques (Fase 4); a leitura de horas serve à Fase 2.

```ts
// src/compartilhado/dinheiro.ts   (acrescenta)
/** `formatarReais(150000) === '1.500,00'`, sem `R$`. `formatarBRL` passa a usar esta. */
export function formatarReais(centavos: number): string;
/** Tabela da secao 3.3. `null` = texto nao e um valor em reais (inclusive vazio). */
export function lerCentavosDeReais(texto: string): number | null;

// src/compartilhado/duracao.ts   (novo)
/** `'10'` → 600, `'7,5'` e `'7.5'` → 450, `'-1'` → -60. Mais de uma casa decimal → `null`. */
export function lerHorasEmMinutos(texto: string): number | null;
/** 600 → `'10'`, 450 → `'7,5'`, 605 → `'10,1'` (so exibicao, arredonda a uma casa). */
export function formatarMinutosEmHoras(minutos: number): string;

// src/compartilhado/numeros.ts   (novo)
/** `^-?\d+$` depois de `trim()`; `'03'` → 3; fora de inteiro seguro → `null`. */
export function lerInteiro(texto: string): number | null;
```

Regras comuns às três leituras: `trim()` antes; texto vazio → `null`; resultado sempre inteiro seguro; **`-0` é normalizado para `0`** (senão `'-0'` gravaria `-0` no IndexedDB, que o *structured clone* preserva). Todas reexportadas por `src/compartilhado/index.ts`.

A tela é quem trata "vazio": no orçamento, texto vazio vira `null` **antes** de chamar `lerCentavosDeReais`; nas metas, vazio é erro de formato.

### 8. Unidade de peso: nenhuma conversão nova

- Este item só **grava a preferência** `unidadeDePeso`. Não existe dado de peso ainda.
- Conforme a pendência 23 e o ADR 0005 (seção 2, regra 5), peso será gravado em **gramas inteiros** (Fase 1) e **nunca é convertido no banco** ao trocar a unidade. A conversão gramas ↔ kg/lb acontece só na exibição e no campo de entrada, e nasce na Fase 1 (itens 1.3/1.5), junto do primeiro campo de peso — não aqui.
- Dica do grupo, para o usuário não ter medo de trocar: "Muda só como os pesos aparecem. Nada do que você registrou é alterado."

### 8.1 Componentes de `src/ui/`

- **`Campo`** ganha `erro?: string` (seção 4). Sem a prop, renderiza exatamente como hoje — a tela `/dados` não muda.
- **`GrupoDeOpcoes`** (novo, `src/ui/GrupoDeOpcoes.tsx`) — rádios nativos em `<fieldset>`/`<legend>`. Nasce com dois usos nesta tela e será usado pelo onboarding (5.3) e pelas fases seguintes:

```ts
export interface OpcaoDoGrupo<V extends string> {
  readonly valor: V;
  readonly rotulo: string;
}
export interface GrupoDeOpcoesProps<V extends string> {
  readonly legenda: string;
  readonly opcoes: readonly OpcaoDoGrupo<V>[];
  readonly valor: V;
  readonly aoMudar: (valor: V) => void;
  readonly dica?: string;
}
export function GrupoDeOpcoes<V extends string>(props: GrupoDeOpcoesProps<V>): ReactElement;
```

  Estrutura: `<fieldset>` + `<legend>` + dica opcional (ligada ao `fieldset` por `aria-describedby`) + um `<label>` por opção **envolvendo** o `<input type="radio">` (`name` por `useId`). O `<label>` inteiro é o alvo de toque, com `min-height: var(--alvo-minimo)` e largura total da linha. Sem desenho próprio do rádio (o nativo, com `accent-color: var(--cor-primaria)`): foco, setas do teclado e leitor de tela vêm do navegador.

- Classes novas em `global.css`: `.campo__erro`, `.grupo-de-opcoes*`. Nada de transição.

### 9. Link a partir da Hoje

A Hoje placeholder em `rotas.tsx` ganha um segundo link, ao lado de "Dados": `<Link to="/configuracoes">Configurações</Link>`, texto em `textos.nucleo.hoje.linkParaConfiguracoes`. O item 0.11 substitui a placeholder e decide a navegação definitiva; o page object `e2e/paginas/hoje.ts` ganha `linkParaConfiguracoes`.

### 10. Textos pt-BR

Em `src/i18n/pt-BR/nucleo.ts`, `hoje.linkParaConfiguracoes: 'Configurações'` e um bloco novo `configuracoes`:

```ts
configuracoes: {
  titulo: 'Configurações',
  introducao: 'As mudanças são salvas sozinhas quando você sai de cada campo.',
  metas: {
    titulo: 'Metas da semana',
    rotuloFoco: 'Horas de foco por semana',
    dicaFoco: 'Use horas inteiras ou com uma casa decimal, por exemplo 10 ou 7,5.',
    rotuloTreinos: 'Treinos por semana',
    dicaTreinos: 'Use 0 se não quiser meta de treino.',
  },
  orcamento: {
    titulo: 'Orçamento',
    rotulo: 'Orçamento do mês (R$)',
    dica: 'Deixe em branco para não usar orçamento. Sem orçamento, a tela Hoje não calcula quanto você pode gastar.',
  },
  unidades: {
    titulo: 'Unidades',
    legendaPeso: 'Unidade de peso',
    dicaPeso: 'Muda só como os pesos aparecem. Nada do que você registrou é alterado.',
    kg: 'Quilogramas (kg)',
    lb: 'Libras (lb)',
  },
  aparencia: {
    titulo: 'Aparência',
    legendaTema: 'Tema',
    sistema: 'Seguir o sistema',
    claro: 'Claro',
    escuro: 'Escuro',
  },
  dados: {
    titulo: 'Dados',
    link: 'Backup, exportar e apagar dados',
  },
  salvo: {
    metaSemanalDeFocoEmMinutos: 'Meta de foco salva.',
    metaSemanalDeTreinos: 'Meta de treinos salva.',
    orcamentoMensalEmCentavos: 'Orçamento salvo.',
    orcamentoRemovido: 'Orçamento removido.',
    unidadeDePeso: 'Unidade de peso salva.',
    tema: 'Tema salvo.',
  },
  erros: {
    formatoFoco: 'Digite as horas com no máximo uma casa decimal, por exemplo 10 ou 7,5.',
    negativoFoco: 'A meta de foco não pode ser negativa.',
    formatoTreinos: 'Digite um número inteiro, por exemplo 3.',
    negativoTreinos: 'A meta de treinos não pode ser negativa.',
    formatoOrcamento: 'Digite um valor em reais, por exemplo 1.500,00.',
    negativoOrcamento: 'O orçamento não pode ser negativo.',
    falhaAoSalvar: 'Não foi possível salvar. Tente de novo.',
  },
},
```

Nenhuma mensagem repete o valor digitado.

### 11. Acessibilidade (mesmo padrão do ADR 0006, seção 7.6)

- Só elementos nativos: `<input>`, `<label>`, `<fieldset>`/`<legend>`, rádios, `<a>`. Ordem de foco = ordem do DOM.
- Todo campo com rótulo visível associado; dica e erro por `aria-describedby`; `aria-invalid` só com erro.
- Alvo mínimo de 44 × 44 px: campos (`.campo__entrada` já tem), cada `<label>` de opção, e o link para `/dados` (`display: inline-flex; min-height: var(--alvo-minimo)`).
- Feedback: sucesso em `role="status"` sempre montado (seção 5); erro em `role="alert"` por campo, montado vazio (seção 4). Nada só por cor: a mensagem de erro é texto.
- Fonte dos campos ≥ 16 px (herdada de `body`), para o Safari não dar zoom ao focar.
- `prefers-reduced-motion`: nada anima; a troca de tema é instantânea (sem `transition` em cor).
- O tema escuro passa a ser **verificado pelo axe** pela primeira vez (critério 16): até hoje o axe só rodou no tema claro.

### 12. Quem faz o quê

| Agente | Arquivos |
|---|---|
| `dominio` | `src/modulos/nucleo/dominio/configuracoes.ts` (`ProblemaDeConfiguracoes`, `CampoNumericoDeConfiguracoes`, `problemasDeConfiguracoes`; `validarConfiguracoes` passa a derivar dela, mesmas mensagens); `src/compartilhado/dinheiro.ts` (`formatarReais`, `lerCentavosDeReais`; `formatarBRL` reusa `formatarReais`), `src/compartilhado/duracao.ts` (novo), `src/compartilhado/numeros.ts` (novo), `src/compartilhado/index.ts`; `src/modulos/nucleo/index.ts` (exporta `aplicarMudancas`, `problemasDeConfiguracoes`, os dois tipos novos e `TelaDeConfiguracoes`). **Nenhuma mudança** em repositório, schema, migração ou contrato de backup. |
| `interface` | `src/modulos/nucleo/telas/Configuracoes.tsx` (+ `Configuracoes.module.css`); `src/ui/Campo.tsx` (prop `erro`), `src/ui/GrupoDeOpcoes.tsx` (novo), `src/ui/index.ts`; `src/app/estilos/tokens.css` (seção 6) e `global.css` (classes novas); `src/app/tema/{tema.ts,useAplicarTema.ts}` (novos; `tema.ts` tem `resolverTema`); `src/app/App.tsx` (chama `useAplicarTema()`); `src/app/rotas.tsx` (rota e link); `index.html` (o `<script>` da seção 6); `src/i18n/pt-BR/nucleo.ts` |
| `testador` | `src/compartilhado/{dinheiro,duracao,numeros}.test.ts`; `src/modulos/nucleo/dominio/configuracoes.test.ts` (casos de `problemasDeConfiguracoes`); `src/app/tema/tema.test.ts`; `src/ui/GrupoDeOpcoes.test.tsx` e `src/ui/Campo.test.tsx` (com `renderToStaticMarkup`, como `AvisoDeAtualizacao.test.tsx`); `e2e/configuracoes.spec.ts`, `e2e/paginas/configuracoes.ts`, `e2e/paginas/hoje.ts` (link novo), uma entrada em `e2e/acessibilidade.spec.ts` |

`resolverTema` é regra de apresentação, não de negócio: mora em `src/app/tema/` e é do agente `interface`.

```ts
// src/app/tema/tema.ts
export type TemaResolvido = 'claro' | 'escuro';
export function resolverTema(tema: Configuracoes['tema'], sistemaEscuro: boolean): TemaResolvido;
```

**Sem dependência nova.** `@testing-library/react` continua fora (pendência 14): os testes de componente usam `renderToStaticMarkup`, e o comportamento (digitar, confirmar, erro, persistência) é coberto pelo e2e, que já roda nos dois navegadores. A decisão sobre a biblioteca passa para o item 0.11.

Ordem: `dominio` e `interface` em paralelo (contrato fechado aqui) → `testador` → **`revisor-critico`**: o item mexe na validação que a importação de backup usa e introduz a conversão de texto em reais para centavos, que é a porta de entrada de todo dinheiro do app a partir da Fase 4.

### 13. Critérios de aceite do item 0.10

O item só está pronto quando todos passarem:

1. `npm run verificar` termina com código 0 e `npm run test:e2e` passa nos dois projetos (a suíte existente inclusive, sem teste pulado a mais).
2. **Nenhuma dependência nova:** `npm ls --depth=0` idêntico ao do item 0.7. Nenhum `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` ou URL de terceiros em `src/` ou `index.html`.
3. **Schema e backup intactos:** nenhum arquivo de `src/persistencia/**`, `repositorio/configuracoes.ts`, `repositorio/contrato-de-dados.ts` ou `dominio/backup/**` muda; `VERSAO_DO_SCHEMA` continua `1`.
4. **Fronteiras:** `Configuracoes.tsx` importa só de `@/modulos/nucleo` (relativo, dentro do módulo), `@/ui`, `@/i18n` e `@/compartilhado`; `src/app/tema/**` não importa `@/persistencia` nem `dexie`; nenhum `eslint-disable` novo.
5. **`problemasDeConfiguracoes`:** padrão → `[]`; `metaSemanalDeFocoEmMinutos: -1` → um problema `{ campo: 'metaSemanalDeFocoEmMinutos', codigo: 'negativo' }`; `1.5` → `naoEhInteiro`; `metaSemanalDeTreinos: -1` → `negativo`; `orcamentoMensalEmCentavos: null` e `0` → `[]`; `-100` → `negativo`; três campos inválidos → três problemas. `validarConfiguracoes` devolve as mesmas mensagens de antes (os testes atuais passam **sem edição**).
6. **Leituras puras:** cada linha da tabela da seção 3.3 é um caso de teste de `lerCentavosDeReais`; `lerCentavosDeReais('0,10') === 10` e `('1234,56') === 123456` (sem erro de ponto flutuante); `lerHorasEmMinutos`: `'10'` → 600, `'7,5'` → 450, `'7.5'` → 450, `'0'` → 0, `'-1'` → -60, `'7,25'`, `''`, `'abc'` → `null`; `lerInteiro`: `'3'` → 3, `'03'` → 3, `'-2'` → -2, `'2,5'`, `''`, `'9007199254740993'` → `null`; `'-0'` → `0` e `Object.is(resultado, -0) === false` nas três; `formatarReais(150000) === '1.500,00'`, `formatarReais(5) === '0,05'`; `formatarBRL(123456) === 'R$ 1.234,56'` continua; `formatarMinutosEmHoras(600) === '10'`, `(450) === '7,5'`, `(605) === '10,1'`, `(0) === '0'`.
7. **`resolverTema`:** `('claro', true) === 'claro'`, `('escuro', false) === 'escuro'`, `('sistema', true) === 'escuro'`, `('sistema', false) === 'claro'`.
8. **Componentes:** `GrupoDeOpcoes` renderiza `<fieldset>`, `<legend>` com a legenda, um `<input type="radio">` por opção dentro do seu `<label>`, todos com o mesmo `name`, e só o do `valor` com `checked`. `Campo` sem `erro` produz o mesmo HTML de antes (sem `aria-invalid`, sem `role="alert"`); com `erro=''`, tem o `role="alert"` vazio e sem `aria-invalid`; com `erro='x'`, tem `aria-invalid="true"` e `aria-describedby` contendo o id do erro.
9. **E2e — valores padrão (dois projetos):** num banco vazio, abrir `/configuracoes` a partir do link da Hoje mostra foco `10`, treinos `3`, orçamento vazio, `Quilogramas (kg)` marcado e `Seguir o sistema` marcado.
10. **E2e — editar e persistir (dois projetos):** digitar `7,5` no foco, `4` nos treinos, `1.500,00` no orçamento (confirmando cada um com `Tab`), marcar `Libras (lb)` e `Escuro`; a região de status mostra a mensagem de cada gravação; **recarregar a página** e reabrir `/configuracoes`: os campos mostram `7,5`, `4`, `1.500,00`, `lb`, `Escuro`. Exportar o backup em `/dados` e conferir no JSON `metaSemanalDeFocoEmMinutos: 450`, `metaSemanalDeTreinos: 4`, `orcamentoMensalEmCentavos: 150000`, `unidadeDePeso: 'lb'`, `tema: 'escuro'` e `onboardingConcluidoEm: null`.
11. **E2e — orçamento removido:** com orçamento salvo, apagar o texto e confirmar mostra "Orçamento removido." e o backup exportado traz `orcamentoMensalEmCentavos: null`.
12. **E2e — erros sem gravar (dois projetos):** `-1` nos treinos mostra `negativoTreinos` com `role="alert"`, o campo fica com `aria-invalid="true"` e mantém o texto `-1`; `7,25` no foco mostra `formatoFoco`; `abc` no orçamento mostra `formatoOrcamento`. Recarregar: os valores gravados são os anteriores. Corrigir o texto e confirmar limpa o erro e grava.
13. **E2e — sem gravação à toa:** entrar e sair de cada campo de texto sem alterar nada e exportar o backup: a quantidade de ações `nucleo.configuracoesSalvas` no histórico é a mesma de antes.
14. **E2e — tema aplicado de verdade (dois projetos):** com `colorScheme: 'dark'` emulado e tema `Seguir o sistema`, `<html data-tema="escuro">` desde o primeiro carregamento; marcar `Claro` → `data-tema="claro"` e o `background-color` calculado do `body` é `rgb(255, 255, 255)`; recarregar → continua `claro`; marcar `Seguir o sistema` → `escuro`; `page.emulateMedia({ colorScheme: 'light' })` → vira `claro` sem recarregar. A meta `theme-color` acompanha (`#ffffff` no claro, `#121212` no escuro, comparando sem diferenciar maiúsculas e sem espaços).
15. **E2e — sobrevive ao fechamento e funciona offline (Chromium, pendência 10):** depois do primeiro carregamento, `context.setOffline(true)`; alterar o foco para `12` **sem sair do campo**, simular o app indo para segundo plano (`page.evaluate` que redefine `document.visibilityState` como `'hidden'` e despacha `visibilitychange` — o Playwright não dispara esse evento de forma determinística no `page.close()`), esperar a mensagem de status e então `page.close()`; abrir uma página nova no mesmo contexto: o foco mostra `12`. Nenhum `requestfailed` nem `console.error` no trecho offline.
16. **E2e — acessibilidade e teclado:** `/configuracoes` entra em `e2e/acessibilidade.spec.ts` e passa nas cinco etiquetas WCAG nos dois projetos, **no tema claro e no tema escuro** (escolhido pela própria tela). Um teste percorre a tela só com teclado (`Tab`, digitação, `Enter`, setas nos rádios) e altera um campo de cada tipo. Todo campo, cada `<label>` de opção e o link para `/dados` têm caixa de pelo menos 44 × 44 px (`boundingBox()`).
17. **Nada de valor fixo novo:** nenhum `600`, `3`, `'kg'` ou `'sistema'` de negócio escrito na tela; os valores exibidos vêm de `useConfiguracoes()` (busca no código, como parte da revisão).
18. `docs/PLANO.md` atualizado (item 0.10 pronto, suposições registradas, pendência 14 movida para 0.11) e `git status` limpo depois do commit.

### 14. O que fica de fora do item 0.10

- **Onboarding** e o preenchimento de `onboardingConcluidoEm` — item 5.3.
- **Conversão e exibição de peso em kg/lb** — Fase 1, com o primeiro campo de peso.
- **Orçamento por mês** — pendência 22, Fase 4 se necessário.
- **Configurações de fases futuras** (Pomodoro, incremento de carga, faixas da regra 7.7, dias de aviso de assinatura) — cada uma na migração da sua fase.
- **Navegação definitiva e a Hoje real** — item 0.11. **Prints** — item 0.13.
- **Manifesto seguindo o tema** — impossível (arquivo estático); ver seção 6.

## Alternativas consideradas

- **Botão "Salvar" único para a tela.** Um só registro no histórico por visita, mas um toque a mais e o risco de sair sem salvar (exigiria aviso de alteração pendente). Salvar por campo é mais simples para quem usa e para o código.
- **Salvar a cada tecla (com atraso).** Sem ação de confirmar, mas gravaria valores intermediários (`1`, `15`, `150`...) e uma ação no histórico por pausa de digitação.
- **Meta de foco em minutos**, ou **em dois campos (horas + minutos)**. Minutos é a unidade gravada, mas não a que o usuário pensa; dois campos dobram o trabalho para um ajuste raro. Horas com uma casa decimal é exato e cabe num campo.
- **`<input type="number">`.** Validação nativa de graça, mas comportamento inconsistente com vírgula no iPhone em pt-BR, aceita `e`, e devolve vazio sem explicação.
- **Máscara de moeda enquanto digita** (estilo "0,00" que empurra os dígitos). Boa no gasto de 3 toques e pode aparecer na Fase 4, mas exige lidar com cursor e colagem; para um campo editado uma vez por mês, texto livre com leitura tolerante basta.
- **Validar "não negativo" na própria função de leitura.** Mais curto, mas colocaria regra de negócio em `compartilhado/` e duplicaria o domínio. A leitura só sabe de formato.
- **Mudar a assinatura de `validarConfiguracoes`** para devolver objetos. Obrigaria mexer no repositório, na importação de backup e nos testes existentes; a função nova ao lado, com a antiga derivada dela, dá o mesmo resultado sem tocar em código aprovado.
- **Tema com `light-dark()` e `color-scheme`**, sem JavaScript para o caso "sistema". É a solução mais curta em CSS, mas exige Safari 17.5+ (iOS 17.5, de maio de 2024), só vira Baseline amplamente disponível em novembro de 2026, e num navegador sem suporte **todas** as cores ficam inválidas de uma vez. O público principal é iPhone; o risco não compensa.
- **Manter o `@media` e acrescentar `[data-tema]` só para a escolha manual.** Exigiria escrever os tokens escuros duas vezes (dentro do `@media` com `:not([data-tema='claro'])` e em `[data-tema='escuro']`), exatamente a duplicação a evitar.
- **Espelhar o tema em `localStorage`** para aplicar antes do primeiro quadro também no tema manual. Eliminaria a troca de alguns milissegundos, ao custo de um segundo armazenamento fora do backup e das transações — já recusado no ADR 0005.
- **`<select>` para tema e unidade.** Componente zero, mas dois toques para trocar e opções escondidas.
- **Instalar `@testing-library/react` agora.** O comportamento desta tela é todo de navegador (foco, `blur`, `visibilitychange`, tema) e o Playwright já cobre nos dois motores; o jsdom não reproduziria o que importa.

## Consequências

- **D4 ganha a sua tela:** metas, orçamento e unidade passam a ser editáveis pelo usuário; as fases 1, 2 e 4 leem `useConfiguracoes()` e não têm desculpa para valor fixo.
- **A entrada de dinheiro do app nasce aqui** (`lerCentavosDeReais`), testada contra ponto flutuante. A Fase 4 reaproveita a mesma função no gasto de 3 toques.
- **O tema passa a depender de JavaScript** e de um `<script>` inline no `index.html`. Se um dia o app ganhar Content-Security-Policy, esse script precisa de hash ou `nonce`.
- **Tema manual diferente do sistema pisca por alguns milissegundos** na abertura; aceito.
- **O tema escuro passa a ser auditado pelo axe**; se algum token escuro não tiver contraste AA, o problema aparece agora e é corrigido em `tokens.css`.
- **Cada campo alterado gera uma ação no histórico** (peso 0). Se o item 5.2 mostrar histórico ao usuário, este tipo fica fora da lista.
- **Meta zero é permitida.** A regra 7.2 (Fase 2) usa `metaSemanal / 7` como capacidade quando há pouco histórico; com meta 0 a capacidade é zero e a razão divide por zero. A entrega da Fase 2 tem de tratar esse caso explicitamente (registrado em "Pendências").

## Pendências

### Bloqueantes

Nenhuma.

### Não bloqueantes (suposições que seguem se não houver resposta)

1. **Salvamento automático por campo**, ao sair do campo, ao tocar `Enter` ou ao a página ficar oculta; sem botão "Salvar". Uma ação no histórico por campo alterado.
2. **Meta de foco digitada em horas, com no máximo uma casa decimal** (`7,5` = 7 h 30 min). Valor importado que não seja múltiplo de 6 minutos é exibido arredondado e só é regravado se o usuário editar.
3. **Orçamento em texto livre** com leitura tolerante (`1500`, `1.500,00`, `R$ 1.500`, `12.50`); em branco = sem orçamento (`null`).
4. **Sem limite superior** para metas e orçamento. Um valor absurdo (ex.: 500 treinos) é aceito; não quebra nenhuma conta.
5. **Meta zero é aceita** (significa "sem meta"). Fica registrado para a Fase 2 tratar a divisão por zero da regra 7.2.
6. **Tema aplicado por `data-tema` no `<html>`**, resolvido em JavaScript (script inline antes da primeira pintura + hook depois de ler a configuração); o `@media` sai do CSS. Tema manual diferente do sistema pode piscar por alguns milissegundos ao abrir.
7. **Meta `theme-color` acompanha o tema escolhido dentro do app**; o manifesto continua `#ffffff` (pendência 48 continua valendo para a tela de abertura do Android).
8. **`@testing-library/react` segue fora** (pendência 14 passa para o item 0.11).
9. **A tela de configurações tem um link para `/dados`**, porque a especificação trata "Configurações e dados" como um só lugar.

## Fontes consultadas em 23/09/2026

- `light-dark()`: suporte a partir do Safari 17.5, Chrome 123, Firefox 120; valor inválido quando consumido em navegador sem suporte: <https://caniuse.com/wf-light-dark> e <https://github.com/mdn/browser-compat-data/issues/22285>
- Baseline "amplamente disponível" de `light-dark()` prevista para novembro de 2026: <https://github.com/takagiyuuki/portfolio/issues/104>
- Experiência prática com `light-dark()` e `color-scheme` em propriedades personalizadas: <https://daverupert.com/2024/05/light-dark-experiment/>
