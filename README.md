# Estrutura multiagentes: webapp de rotina pessoal

Pasta pronta para o Claude Code construir o app descrito em `docs/ESPECIFICACAO.md` com seis subagentes (arquiteto, dominio, interface, testador, revisor e revisor-critico), te perguntando pelo Telegram quando precisar.

## Começar
```
node setup.mjs   # uma vez: dependências, git, Telegram, GitHub
iniciar.cmd      # Windows: abre o Claude Code com o canal e sem hibernar
```
Dentro do Claude Code:
- `/configurar`: relê a especificação e ajusta plano e agentes (use ao trocar de projeto: `/configurar caminho/da/spec.md`).
- `/construir`: constrói o app inteiro, da Fase 0 à 5. Só para para aprovar a stack e para perguntas bloqueantes. No fim, manda o link e um roteiro de teste no iPhone.
- `/fase N`: executa uma fase só, se quiser ir por partes.

## Arquivos
| Caminho | Para quê |
|---|---|
| `CLAUDE.md` | Regras do orquestrador (sessão principal) |
| `.claude/agents/` | Os seis subagentes |
| `docs/prints/` | Prints de cada fase, em iPhone emulado |
| `.claude/commands/` | `/configurar`, `/construir` e `/fase` |
| `.claude/settings.json` | Permissões e hook de aviso no Telegram |
| `docs/ESPECIFICACAO.md` | Especificação do produto (fonte da verdade) |
| `docs/PLANO.md` | Fases, status, riscos, perguntas e decisões |
| `docs/adr/` | Decisões de arquitetura |
| `scripts/notificar-telegram.mjs` | Aviso "estou te esperando" pelo seu bot atual |

## Antes de começar
- Conta no GitHub (o `setup.mjs` ajuda a criar o repositório privado).
- Conta gratuita numa hospedagem estática (Cloudflare Pages, Netlify ou Vercel). A conexão é feita na Fase 0, com passo a passo enviado pelo Claude.

## Telegram, dois bots
- **Seu bot atual**: só recebe avisos (o hook usa `sendMessage`, não conflita com o que ele já faz). Credenciais em `~/.config/claude-multiagentes/telegram.env`.
- **Bot dedicado**: conversa nos dois sentidos pelo canal oficial do Claude Code. Precisa ser outro bot, porque só um programa pode ler as mensagens de cada bot.

Os tokens ficam fora da pasta do projeto e nunca entram no git.
