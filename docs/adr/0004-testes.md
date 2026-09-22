# 0004. Máquina de testes: unitário, e2e e acessibilidade

- Data: 2026-09-21
- Status: **aceita**

## Contexto

Item 0.4 do `docs/PLANO.md`: "Testes unitários, e2e e de acessibilidade rodando (um de cada)".

O item **não** é cobertura de produto — é a **máquina**. Cobertura entra item a item, nas fases seguintes, contra os critérios de aceite de cada funcionalidade (seção 11 da especificação, Definition of Done). O que o 0.4 entrega é: um exemplo real e honesto de cada um dos três tipos, rodando de ponta a ponta, mais o **padrão** que o agente `testador` replica daqui em diante sem precisar decidir de novo.

O que a especificação exige (seção 9, "Testes"):

- unitários para todas as regras da seção 7 **e para as migrações de schema**;
- e2e para os fluxos críticos (registrar gasto, treino completo, revisar flashcards, exportar/importar backup);
- **teste automatizado de acessibilidade nas telas principais**, com o alvo da seção 9: **WCAG 2.2 nível AA**.

O que já existe (itens 0.2 e 0.3):

| Peça | Estado |
|---|---|
| `src/compartilhado/identificador.test.ts` e `dinheiro.test.ts` | dois testes unitários reais, passando |
| `vitest.setup.ts` | `import 'fake-indexeddb/auto'` — **nunca exercitado** |
| `e2e/placeholder.spec.ts` | um `test.skip`, criado só para `playwright test --list`; sai neste item (pendência 11) |
| `playwright.config.ts` | projetos `iphone-webkit` e `android-chromium` (D3), `webServer` = `npm run build && npm run preview` em `:4173` |
| `@axe-core/playwright` | instalado no item 0.2, **sem nenhum uso** |
| `e2e/fixtures/`, `e2e/paginas/`, `e2e/utilitarios/` | pastas com `.gitkeep` (ADR 0002) |
| CI (ADR 0003) | roda `test:unit` e `test:e2e -- --grep-invert "@prints"` em todo push de código |

Restrições que o desenho precisa respeitar:

- **D3**: todo e2e roda em WebKit/iPhone **e** Chromium/Android. Sem teste manual até o fim (D2), um problema de Safari só aparece se alguém rodar WebKit a cada push.
- **ADR 0003, seção 8**: os testes novos passam nos dois projetos ou pulam explicitamente com motivo; nenhuma alteração no `ci.yml` deve ser necessária. Specs de print usam a etiqueta `@prints` no título (item 0.13, fora deste item).
- **ADR 0002**: unitário ao lado do código; e2e em `/e2e` com `paginas/`, `fixtures/`, `utilitarios/`; o `testador` é dono de `e2e/**`, `*.test.ts(x)` e `vitest.setup.ts`, e **de mais nada** — se um teste só passa mudando código de produção, o `testador` reporta, não conserta (`CLAUDE.md`).
- **Tipos estritos valem para `e2e/`**: o `tsconfig.json` inclui `e2e` e liga `erasableSyntaxOnly` — **parâmetro-propriedade no construtor do page object é erro de compilação** (`constructor(private readonly page: Page)` não compila).
- **Não há tela real.** O que a aplicação renderiza hoje é `<p>Hoje</p>` dentro de `#root`, com `index.html` em `lang="pt-BR"` e `<title>[NOME DO APP]</title>`. As telas Hoje e Configurações chegam nos itens 0.10 e 0.11.

Estado das ferramentas verificado em 21/09/2026 (fontes ao fim):

| Item | Situação hoje | Efeito na decisão |
|---|---|---|
| `@axe-core/playwright` 4.13 | uso é `new AxeBuilder({ page }).withTags([...]).analyze()`; resultado tem `violations` e `incomplete`; anexar o JSON ao `TestInfo` é o padrão documentado | é a API usada na seção 4 |
| Etiquetas do axe | `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`. **Não são cumulativas**: `wcag2aa` não contém `wcag2a` | para cobrir "WCAG 2.2 AA" é preciso listar as **cinco** etiquetas WCAG |
| `target-size` (alvo de toque) | regra etiquetada `wcag22aa` | só é verificada se `wcag22aa` estiver na lista — e a seção 9 exige alvo de toque |
| `fake-indexeddb` 6 + Vitest | `import 'fake-indexeddb/auto'` num `setupFiles` é o caminho suportado, mas há relato recorrente de "IndexedDB is not defined" em Vitest quando o setup não é aplicado como se espera; isolamento entre testes se faz com `new IDBFactory()` ou com nome de banco distinto | justifica a prova de ambiente da seção 3 |

## Decisão

### 1. Escopo do item 0.4

Entra:

| Tipo | Arquivo | Quantidade |
|---|---|---|
| Unitário puro | `src/compartilhado/identificador.test.ts`, `dinheiro.test.ts` (já existem) | mantidos |
| Unitário de infraestrutura | `src/persistencia/ambiente.test.ts` (**novo**) | 2 casos |
| E2e de fumaça | `e2e/app-carrega.spec.ts` (**novo**) | 1 teste × 2 projetos |
| Acessibilidade | `e2e/acessibilidade.spec.ts` (**novo**) | 1 teste × 2 projetos |
| Infra de teste | `e2e/fixtures/base.ts`, `e2e/paginas/hoje.ts`, `e2e/utilitarios/acessibilidade.ts` (**novos**) | — |
| Remoção | `e2e/placeholder.spec.ts` | apagado |

Não entra (e por quê):

- **`@testing-library/react` + `user-event`.** O ADR 0002 previa a instalação neste item. **Adiado** para o item 0.10/0.11: hoje não existe nenhum componente com comportamento para testar em isolamento, e instalar biblioteca para zero uso é peso morto. Quem for implementar os testes da tela de Configurações instala.
- **`e2e/prints.spec.ts`** — é o item 0.13 (D6).
- **Teste de service worker / offline** — depende do PWA do item 0.7 e roda só em `android-chromium` (pendência 10).
- **Cobertura das regras da seção 7** — elas ainda não existem.

### 2. Como escolher o tipo de teste (vale para todas as fases)

| O que foi implementado | Teste obrigatório | Onde |
|---|---|---|
| Regra pura da seção 7 | unitário, com casos de borda | ao lado do arquivo (`x.ts` → `x.test.ts`) |
| Schema novo ou migração | unitário com `fake-indexeddb`: grava na versão antiga, abre na nova, confere o dado migrado | `src/persistencia/**/*.test.ts` |
| Repositório (consulta, soft delete, transação) | unitário com `fake-indexeddb` | ao lado do repositório |
| Fluxo do usuário (3 toques, fechar e reabrir, offline, exportar/importar) | e2e nos dois projetos | `e2e/<fluxo>.spec.ts` |
| Tela nova visível | **uma linha** na lista `TELAS` de `e2e/acessibilidade.spec.ts` | `e2e/acessibilidade.spec.ts` |
| Componente com lógica visual isolada | opcional, `@testing-library` (quando instalada) | ao lado do componente |

### 3. Camada unitária: o que falta é a prova do ambiente de banco

Os dois testes do item 0.2 **já cumprem** a fatia "unitário" em si: são reais, cobrem `compartilhado/` e rodam no `verificar` e no CI. Não há motivo para inventar um terceiro teste de função pura só para preencher o item.

Falta outra coisa. O `vitest.setup.ts` declara `fake-indexeddb/auto` e **ninguém nunca abriu um banco**. O item 0.5 (schema, repositórios e migrações) é a parte mais cara e mais crítica da Fase 0, e começaria descobrindo, junto com o schema real, se Dexie 4 abre no Vitest 5 em `environment: 'node'`, se `version().upgrade()` roda sob `fake-indexeddb` e como isolar um teste do outro. São três riscos de ferramenta misturados a um risco de modelagem.

Decisão: **`src/persistencia/ambiente.test.ts`, agora**, com um banco descartável e explicitamente não-oficial. Ele não antecipa o schema real — usa uma tabela `provas` inventada, e o item 0.5 não deve importá-la nem imitá-la.

Contrato:

1. **Caso 1 — ida e volta.** Abrir `new Dexie(nomeUnico)` com `version(1).stores({ provas: 'id, criadoEm' })`, gravar um registro `{ id: gerarIdentificador(), criadoEm: <ISO>, valorEmCentavos: 123456 }`, ler por chave primária e conferir igualdade; ler pelo índice `criadoEm` e conferir que devolve 1 registro. Prova: `fake-indexeddb` está ativo, Dexie abre, índice funciona, e o UUID v7 de `compartilhado/` serve como chave.
2. **Caso 2 — upgrade de versão.** No mesmo banco: fechar, reabrir declarando `version(1)` **e** `version(2).stores({ provas: 'id, criadoEm, categoria' }).upgrade(...)` que preenche `categoria: 'sem-categoria'` nos registros antigos; conferir que o registro gravado na v1 chega migrado na v2 e que o índice novo consulta. Prova: a mecânica de migração do Dexie funciona no ambiente de teste — que é exatamente o que o item 0.5 vai precisar e o que a especificação (seção 9) exige testar.
3. **Isolamento:** nome de banco único por teste (`prova-${gerarIdentificador()}`), `db.close()` em `afterEach`. Testes de persistência nunca compartilham nome de banco; se um dia o isolamento não bastar, a alternativa registrada é trocar `globalThis.indexedDB` por `new IDBFactory()` em `beforeEach`.
4. **Sem alteração no `vitest.setup.ts`.** Se `IndexedDB is not defined` aparecer, o problema é de configuração do Vitest e é ele que se ajusta — não se contorna com import no arquivo de teste.
5. O arquivo abre com um comentário de três linhas dizendo que é prova de ambiente, que a tabela é descartável e que o schema real é o do item 0.5.

O `environment: 'node'` do `vitest.config.ts` continua valendo (`fake-indexeddb` não precisa de DOM).

### 4. Camada e2e: uma fumaça honesta + a guarda de console que todas as fases herdam

Sem tela real, o único e2e honesto é o de fumaça: **o app builda, sobe, carrega e monta, nos dois navegadores, sem erro**. Ele não é decorativo — hoje ele já cobre o pior modo de falha de um SPA (tela branca por exceção no boot) e é o teste que vai quebrar primeiro quando o item 0.7 mexer no service worker ou o 0.5 abrir o Dexie no boot.

#### 4.1 `e2e/fixtures/base.ts` — o `test` do projeto

Todo spec importa `test` e `expect` **daqui**, nunca de `@playwright/test` direto. Isso dá, de graça e para sempre, a guarda de erro de console e é o lugar onde fixtures futuras (banco semeado, contexto offline) entram sem tocar em cada spec.

```ts
// e2e/fixtures/base.ts
import { test as base, expect } from '@playwright/test';

type Fixtures = {
  /** Erros de console tolerados no arquivo, via `test.use({...})`. Vazio = nenhum. */
  errosDeConsoleEsperados: RegExp[];
  guardaDeConsole: void;
};

export const test = base.extend<Fixtures>({
  errosDeConsoleEsperados: [[], { option: true }],

  // Automatica: vale para todo teste que importar este `test`.
  guardaDeConsole: [
    async ({ page, errosDeConsoleEsperados }, use) => {
      const erros: string[] = [];
      const tolerado = (texto: string) => errosDeConsoleEsperados.some((padrao) => padrao.test(texto));

      page.on('console', (mensagem) => {
        if (mensagem.type() === 'error' && !tolerado(mensagem.text())) {
          erros.push(`console.error: ${mensagem.text()}`);
        }
      });
      page.on('pageerror', (erro) => {
        if (!tolerado(erro.message)) erros.push(`pageerror: ${erro.message}`);
      });

      await use();

      expect(erros, 'A pagina nao pode registrar erro de console nem excecao nao tratada').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
```

Regra de uso: tolerar um erro é sempre por arquivo, com `test.use({ errosDeConsoleEsperados: [/.../] })` e um comentário dizendo por que aquele erro é aceitável. Nunca desligando a fixture.

#### 4.2 `e2e/app-carrega.spec.ts`

Substitui o `placeholder.spec.ts` (que é **apagado** no mesmo commit). Um teste, sem `skip`, nos dois projetos:

1. `const hoje = new PaginaHoje(page); const resposta = await hoje.abrir();`
2. `expect(resposta.status()).toBeLessThan(400)` — o preview serviu a página.
3. `await expect(hoje.raiz).not.toBeEmpty()` — o React montou (tela branca por exceção falha aqui).
4. `await expect(page).toHaveTitle(NOME_DO_APP)`, importando `NOME_DO_APP` de `@/i18n`. Além de verificar o título, isso amarra o teste ao arquivo de tradução: quando o usuário definir o nome do app (pendência 8/9), nada de teste precisa mudar.
5. A guarda de console da seção 4.1 fecha o teste sem nenhuma linha extra no spec.

Se o alias `@/` não resolver dentro de `e2e/` na versão instalada do Playwright, o `testador` **não** altera `tsconfig.json` nem `playwright.config.ts`: troca por um `import` relativo (`../src/i18n`) e registra no relatório. Duplicar a string `'[NOME DO APP]'` no teste é proibido.

#### 4.3 Os dois projetos

Ambos os specs rodam em `iphone-webkit` e `android-chromium`, sem exceção. `test.skip` por navegador só com a forma condicional e um comentário com o motivo (`test.skip(({ browserName }) => browserName === 'webkit', 'motivo')`), e o motivo vai para `docs/PLANO.md`. `test.only` é proibido (o CI já barra com `forbidOnly`).

### 5. Camada de acessibilidade

#### 5.1 `e2e/utilitarios/acessibilidade.ts`

```ts
// e2e/utilitarios/acessibilidade.ts
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

/**
 * WCAG 2.2 AA (especificacao, secao 9). As etiquetas do axe NAO sao cumulativas:
 * `wcag22aa` nao contem `wcag2a`. Por isso as cinco precisam estar na lista.
 * `best-practice` fica de fora de proposito (ver ADR 0004, "Alternativas").
 */
export const ETIQUETAS_WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export async function verificarAcessibilidade(
  page: Page,
  info: TestInfo,
  nomeDaTela: string,
): Promise<void> {
  const resultado = await new AxeBuilder({ page }).withTags(ETIQUETAS_WCAG_AA).analyze();

  await info.attach(`axe-${nomeDaTela}`, {
    body: JSON.stringify(
      { violacoes: resultado.violations, indeterminado: resultado.incomplete },
      null,
      2,
    ),
    contentType: 'application/json',
  });

  const resumo = resultado.violations.map(
    (v) => `${v.id} (${v.impact ?? 'sem impacto'}): ${v.help} -> ${v.nodes[0]?.target.join(' ')}`,
  );
  expect(resumo, `Violacoes WCAG 2.2 AA em "${nomeDaTela}"`).toEqual([]);
}
```

Decisões embutidas:

- **Falha só em `violations`.** `incomplete` (o que o axe não conseguiu decidir sozinho, tipicamente contraste sobre imagem) vai para o anexo e é lido por humano; transformar "precisa revisar" em vermelho deixaria a suíte inutilizável.
- **O anexo sempre é gravado**, inclusive quando passa: é o insumo da auditoria do item 5.5.
- **A mensagem de falha é legível** (regra, impacto, ajuda e o seletor do primeiro nó), para o relatório do `testador` não exigir abrir o JSON.
- **`disableRules()` e `exclude()` são proibidos por padrão.** Cada uso precisa de comentário com o motivo e registro em `docs/PLANO.md`. Desligar regra de acessibilidade em silêncio é como o requisito da seção 9 morre.
- Se o import default não compilar sob as flags do `tsconfig`, o `testador` reporta ao orquestrador em vez de mexer no `tsconfig.json` (arquivo do agente `dominio`).

#### 5.2 `e2e/acessibilidade.spec.ts`

Um arquivo só, com uma lista de telas, para que cada fase acrescente **uma linha**:

```ts
const TELAS = [{ nome: 'hoje', abrir: (page: Page) => new PaginaHoje(page).abrir() }];

for (const tela of TELAS) {
  test(`sem violacao WCAG 2.2 AA: ${tela.nome}`, async ({ page }, info) => {
    await tela.abrir(page);
    await verificarAcessibilidade(page, info, tela.nome);
  });
}
```

Telas que só existem depois de um fluxo (ex.: "treino em andamento") entram como entrada com `abrir` próprio, usando o page object correspondente.

#### 5.3 Roda nos dois projetos

Sim, nos dois — sem exceção, como manda D3. O custo marginal é o tempo do scan (a navegação, que é a parte cara, já aconteceria de qualquer forma) e o benefício é real: nome acessível e ordem de foco calculados pelo motor do Safari são o que o usuário vai encontrar no iPhone.

**Gatilho de reavaliação, objetivo:** se `e2e/acessibilidade.spec.ts` sozinho passar de 90 s no CI, restringir a `iphone-webkit` (`test.skip(({ browserName }) => browserName !== 'webkit')`) e registrar no plano. WebKit é o que fica, porque é a plataforma real do usuário.

### 6. Contrato do page object (`e2e/paginas/`)

Vale para toda tela, de agora até a Fase 5:

1. **Um arquivo por tela**, kebab-case, com uma classe `Pagina<Tela>` (`e2e/paginas/hoje.ts` → `PaginaHoje`).
2. **Nada de parâmetro-propriedade** (`erasableSyntaxOnly`): campo declarado e atribuído no corpo do construtor.
3. **O caminho da rota é `static readonly caminho`**; nenhum spec escreve URL literal.
4. **Locators são campos `readonly`**, montados no construtor com **papel e nome acessível** (`getByRole`, `getByLabel`, `getByRole('heading', { name })`). `getByTestId` é último recurso, com comentário; seletor de CSS/classe é proibido (exceto `#root`, que é estrutura do `index.html`, não estilo). Consequência deliberada: um elemento que o teste não consegue localizar por papel/nome é um elemento que o leitor de tela também não descreve — o teste vira o primeiro detector de problema de acessibilidade.
5. **Todo texto usado em locator vem de `@/i18n`**, nunca literal duplicado.
6. **`abrir()`** navega, espera uma âncora estável da tela e devolve a `Response` (ou lança, se não houver).
7. **Ações são métodos com verbo em pt-BR** (`registrarGasto(valorEmCentavos, categoria)`), `Promise<void>`, e representam o que o *usuário* faz — nada de "clicar no terceiro botão". O contador de toques da regra dos 3 toques sai daí.
8. **Sem `expect` dentro do page object.** Asserção é do spec; o page object só localiza, age e espera. (Exceção: `abrir()` pode lançar erro próprio quando não há resposta HTTP.)
9. **Sem acesso a banco, `localStorage` ou estado interno** para montar cenário. Preparação de dados é fixture (`e2e/fixtures/`), não page object.

`e2e/paginas/hoje.ts` nasce mínimo — `caminho`, `raiz` (`page.locator('#root')`) e `abrir()` — com um comentário dizendo que o item 0.11 acrescenta os locators reais da tela Hoje. É pouco código de propósito: é o formato que importa.

### 7. O que o `testador` roda e reporta em toda entrega

`npm run verificar` **não** inclui e2e (precisa de navegador e de build servido) — e isso não muda. O protocolo cobre a diferença. Antes de devolver qualquer funcionalidade ao orquestrador (passo 4 do fluxo do `CLAUDE.md`), o `testador` roda, nesta ordem, e cola o resultado no relatório:

```
Verificacao
- npm run verificar .............. OK | FALHOU (<passo>)
- npm run test:e2e ............... OK | FALHOU  (N testes, iphone-webkit + android-chromium)
- Acessibilidade ................. 0 violacoes WCAG 2.2 AA em: <telas>  (M indeterminados)
- Testes novos ................... <arquivos>
- Criterios de aceite ............ <criterio N> -> <arquivo::nome do teste>  (um por linha)
- Pulados / tolerados ............ <test.skip, errosDeConsoleEsperados, disableRules> + motivo (ou "nenhum")
```

Regras do protocolo:

- **Rodar a suíte inteira**, nunca `--grep`/`--project` para esconder vermelho. Filtro só para depurar.
- **Todo critério de aceite aparece mapeado para um teste nominal.** Critério sem teste é entrega incompleta — e é o que o `revisor`/`revisor-critico` confere primeiro.
- **O `testador` não corrige código de produção** (`CLAUDE.md`). Falha vira apontamento para o `dominio` ou a `interface`, com o comando que reproduz.
- Qualquer `skip`, erro de console tolerado ou regra do axe desligada aparece na última linha **e** em `docs/PLANO.md`. Item invisível aqui é dívida escondida.

### 8. Critérios de aceite do item 0.4

O `testador` só declara o item pronto quando todos passarem:

1. `e2e/placeholder.spec.ts` não existe mais no repositório.
2. `npm run test:unit` passa com **três** arquivos: os dois de `src/compartilhado/` e `src/persistencia/ambiente.test.ts`, este com os dois casos da seção 3 (ida e volta e upgrade v1→v2). A saída do Vitest, com a contagem, vai no relatório.
3. **Prova de que a prova de ambiente prova algo:** comentar a linha do `vitest.setup.ts` faz `ambiente.test.ts` falhar com erro de IndexedDB indefinido; desfazer. Saída no relatório.
4. `npx playwright test --list` mostra **exatamente 4 testes** (2 specs × 2 projetos), nenhum pulado.
5. `npm run test:e2e` termina verde nos dois projetos, partindo de um repositório **sem `dist/`** (o `webServer` faz `build` + `preview` sozinho).
6. **Prova de falha do e2e:** plantar `throw new Error('x')` no início de `src/app/main.tsx` faz `app-carrega` falhar em ambos os projetos, com mensagem apontando `pageerror` ou `#root` vazio; desfazer e confirmar verde. Saída no relatório.
7. **Prova de falha da acessibilidade:** plantar `<img src="/icones/x.png" />` sem `alt` na tela renderizada, rodar `e2e/acessibilidade.spec.ts` e confirmar falha citando a regra `image-alt`; desfazer e confirmar verde. Saída no relatório. (Como o app hoje não tem tela de verdade, este é o único jeito de provar que o portão morde.)
8. O anexo `axe-hoje` aparece no relatório HTML do Playwright, mesmo na execução verde, com `violacoes: []`.
9. `e2e/fixtures/base.ts`, `e2e/paginas/hoje.ts` e `e2e/utilitarios/acessibilidade.ts` existem, seguem as seções 4, 5 e 6, e **nenhum spec importa `test` de `@playwright/test`** diretamente.
10. Nenhum `test.only`, nenhum `test.skip` incondicional, nenhum `disableRules`/`exclude` do axe, nenhum `errosDeConsoleEsperados` não vazio.
11. `npm run verificar` continua verde, incluindo `lint`, `format:check` e `typecheck` **sobre `e2e/`** (o `tsconfig` inclui essa pasta).
12. **Nenhuma dependência nova**: `npm ls --depth=0` idêntico ao do item 0.3.
13. O CI fica verde no push, com o job `e2e` executando os 4 testes (o `--grep-invert "@prints"` não exclui nenhum deles). Tempo do job anotado; se passar de 8 min, abrir a pendência de cache de navegadores do ADR 0003, seção 4.
14. `git status` limpo depois do commit: nada de `test-results/`, `playwright-report/` ou `dist/` versionado.
15. O relatório final segue o bloco da seção 7.

## Alternativas consideradas

- **Considerar a fatia unitária já cumprida pelos dois testes do item 0.2 e não escrever mais nada.** É defensável ao pé da letra do item ("um de cada"). Recusado porque deixaria `fake-indexeddb` sem prova e o item 0.5 — o mais crítico da fase — começaria depurando ferramenta e modelagem ao mesmo tempo. O custo é um arquivo de ~40 linhas.
- **Esperar o item 0.5 para qualquer teste de Dexie.** Mesma discussão, invertida: o teste de migração de verdade é do 0.5 e continua sendo. O que se antecipa aqui é só a prova de que o ambiente suporta abrir banco e subir versão, com uma tabela descartável. Se o 0.5 quiser apagar `ambiente.test.ts` depois de ter os testes reais de migração, é decisão dele — mas custa quase nada mantê-lo, e ele isola "quebrou o ambiente" de "quebrou o schema".
- **Um e2e "de verdade" agora, inventando uma interação.** Seria inventar tela fora da especificação para ter o que testar. Proibido pelo `CLAUDE.md` (nada fora da especificação) e enganoso: um teste que exercita uma tela falsa não prova nada sobre o produto.
- **Manter o `placeholder.spec.ts` como `skip`.** Um teste pulado é ruído permanente no relatório e mentiria sobre a contagem. Sai agora, como previa a pendência 11.
- **Só `wcag2a` + `wcag2aa` no axe** (sugestão inicial da delegação). Recusado: as etiquetas do axe não são cumulativas e a seção 9 pede **WCAG 2.2 AA**. Ficariam de fora, entre outras, `target-size` (alvo de toque, `wcag22aa`) e as regras de 2.1 que valem em celular — justamente o que mais importa aqui. As cinco etiquetas custam o mesmo tempo de execução.
- **Incluir `best-practice`.** Traria `region`, `landmark-one-main` e `page-has-heading-one` — coisas boas, que hoje **falhariam** na casca vazia. Não entram no portão porque não são WCAG AA e porque o jeito certo de garanti-las é exigir `main` e um `h1` nas telas dos itens 0.10/0.11, como requisito de tela. **Gatilho de reavaliação:** quando a tela Hoje real existir, o `testador` roda uma vez com `best-practice` e propõe promover as violações que fizerem sentido.
- **Acessibilidade só em `iphone-webkit`.** Economizaria alguns segundos. Recusado agora porque D3 não abre exceção sem motivo escrito e porque nome acessível depende do motor. Fica com gatilho objetivo (seção 5.3).
- **Acessibilidade embutida em cada spec de fluxo** (rodar axe ao fim de todo teste) em vez de um arquivo dedicado. Dá cobertura maior de graça, mas mistura o motivo da falha (um fluxo vermelho por contraste confunde quem lê) e multiplica o tempo. O arquivo dedicado com lista de telas mantém "uma linha por tela nova" e um veredito separado.
- **Instalar `@testing-library/react` agora**, como o ADR 0002 previa. Adiado por falta de uso (ver seção 1). É substituição pontual desse trecho do ADR 0002, não reabertura dele.
- **Guarda de console como asserção manual em cada spec.** Repetição garantida e esquecimento garantido. A fixture automática custa 25 linhas uma vez.
- **Relatório de cobertura (`vitest --coverage`) como portão do item 0.4.** Com três arquivos de teste, percentual de cobertura seria teatro. Fica para quando as regras da seção 7 existirem (o `vitest.config.ts` já está preparado, mirando `dominio/` e `persistencia/`).

## Consequências

- O item 0.5 chega com o ambiente de banco já provado: se `ambiente.test.ts` está verde e o teste de migração novo está vermelho, o problema é o schema, não a ferramenta.
- Toda tela nova passa a custar **uma linha** em `e2e/acessibilidade.spec.ts`. Se alguém esquecer, o `revisor` tem um critério objetivo para reprovar, e a Definition of Done ("passa na verificação automática de acessibilidade") deixa de depender de memória.
- A regra "locator por papel e nome acessível" faz o e2e falhar quando a interface não tem rótulo — acessibilidade vira consequência de escrever teste, não uma auditoria separada no fim.
- O `e2e/app-carrega.spec.ts` vira o canário da fase: é ele que vai acusar o service worker do item 0.7 quebrando o boot, ou o Dexie do 0.5 lançando no carregamento.
- Preço a pagar: dois arquivos de infraestrutura (`base.ts` e `acessibilidade.ts`) para manter, e a disciplina de importar `test` do lugar certo. Em troca, nenhum spec futuro precisa decidir nada sobre console, axe ou etiquetas WCAG.
- O CI passa de 2 testes pulados para 4 testes executados nos dois navegadores. É o primeiro aumento real de tempo do job `e2e`; o gatilho de cache do ADR 0003 continua valendo.
- Fica de fora deste item e é dívida consciente: cobertura das regras da seção 7 (não existem), teste de offline/service worker (0.7), prints (0.13), testes de componente (0.10/0.11), auditoria de desempenho e de acessibilidade manual com teclado e VoiceOver (5.5).
- A verificação com teclado que a Definition of Done pede **não** é coberta pelo axe. Quando houver interação real, entra como passo de e2e (`page.keyboard.press('Tab')` + `toBeFocused`), especificado no item que criar a tela.

## Pendências (não bloqueantes)

1. O `testador` precisa **apagar** `e2e/placeholder.spec.ts`. `Bash(git rm:*)` não está no `allow` do `.claude/settings.json` e `rm` também não — o orquestrador autoriza o comando na hora ou remove o arquivo por outro meio. Não é motivo para deixar o arquivo no repositório.
2. `@testing-library/react` e `@testing-library/user-event`: instalação movida do item 0.4 para o 0.10/0.11.
3. Etiquetas `best-practice` do axe: fora do portão até existir tela real; reavaliar no item 0.11, junto com a exigência de `main` e `h1`.

## Fontes consultadas em 21/09/2026

- Playwright — teste de acessibilidade com `@axe-core/playwright` (uso de `AxeBuilder`, `withTags`, anexo no `TestInfo`, `exclude`/`disableRules`): <https://playwright.dev/docs/accessibility-testing>
- axe-core — descrição das regras e suas etiquetas (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`; etiquetas não cumulativas): <https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md>
- axe-core — API (`withTags`, `violations` × `incomplete`): <https://github.com/dequelabs/axe-core/blob/master/doc/API.md>
- `fake-indexeddb` — `fake-indexeddb/auto`, isolamento com `new IDBFactory()`: <https://github.com/dumbmatter/fakeIndexedDB>
- Playwright — fixtures automáticas e opções de teste (`option: true`, `auto: true`): <https://playwright.dev/docs/test-fixtures>
