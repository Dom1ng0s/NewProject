---
description: Executa uma fase do plano do começo ao fim.
argument-hint: [número da fase]
---

Execute a Fase $ARGUMENTS de `docs/PLANO.md`.

1. Para cada item da fase, na ordem: contrato curto → `dev` → `revisor` (só em item de risco) → atualiza o status no plano → commit.
2. Agrupe itens pequenos e relacionados numa única chamada ao `dev`. Um item por vez só quando o item for grande.
3. Garanta o cartão e o atalho da fase na tela Hoje (D4).
4. No fim da fase: `npm run verificar`, depois `npm run test:e2e:prints` para os prints em `docs/prints/fase-N/`.
5. Relatório de 3 a 5 linhas e siga para a próxima fase (D2). Não espere aprovação.
