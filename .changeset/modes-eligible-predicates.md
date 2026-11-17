---
'@weasel-js/modes': major
---

`eligibleTool` is `isToolEligible` and `eligibleContribution` is `isContributionEligible`, named as the predicates they are.

```ts
// before
if (eligibleTool(registry, tool)) …
// after
if (isToolEligible(registry, tool)) …
```

<!-- entry: breaking api -->
