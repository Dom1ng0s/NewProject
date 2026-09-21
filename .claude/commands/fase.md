---
description: Executa uma fase do plano do começo ao fim, parando nos pontos de aprovação.
argument-hint: [número da fase]
---

Execute a Fase $ARGUMENTS de `docs/PLANO.md`.

1. Confirme que os itens da fase anterior estão como "pronto". Se algum não estiver, conclua-o antes.
2. Para cada funcionalidade da fase, na ordem do plano, rode o fluxo completo do `CLAUDE.md` (arquiteto → perguntas → dominio → interface → testador → revisor → commit).
3. Mantenha `docs/PLANO.md` atualizado a cada funcionalidade concluída.
4. Confirme que a tela Hoje recebeu o cartão e o atalho desta fase (D4).
5. Rode a suíte e2e completa para gerar os prints em `docs/prints/fase-N/`.
6. Envie o relatório de fase como descrito no `CLAUDE.md` (texto curto + prints + link). Não espere aprovação (D2).
