---
description: Configura esta pasta para um novo projeto a partir de uma especificação (texto colado ou arquivo).
argument-hint: [caminho do arquivo ou texto da especificação]
---

Configure esta estrutura multiagentes para o projeto descrito abaixo.

Entrada: $ARGUMENTS
(Se vazio, use `docs/ESPECIFICACAO.md`. Se for um caminho de arquivo, leia o arquivo. Se for texto, salve em `docs/ESPECIFICACAO.md`.)

Passos:
1. Delegue ao **arquiteto** a leitura da especificação com esta tarefa:
   - Reescrever `docs/PLANO.md`: visão, fases e funcionalidades (tabela com status "a fazer"), riscos técnicos, e pendências.
   - Atualizar no `CLAUDE.md` as seções "O produto em uma frase", "Princípios", "Fases" e a tabela de subagentes, se o projeto pedir outros papéis.
   - Ajustar os prompts em `.claude/agents/` às regras e convenções da especificação (convenções de dados, casos de teste obrigatórios, critérios do revisor).
   - Listar ambiguidades, contradições e riscos da especificação como PERGUNTAS AO USUÁRIO.
2. Mostre ao usuário um resumo do que mudou.
3. Envie as perguntas bloqueantes (pelo Telegram, se o canal estiver ativo) e espere as respostas.
4. Registre as respostas em `docs/PLANO.md` > Decisões.
5. Faça o commit `chore: configura estrutura multiagentes`.

Não escreva código de produção neste comando.
