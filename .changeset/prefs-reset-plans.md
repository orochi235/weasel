---
'@weasel-js/prefs': major
---

`resetPlanAt` is renamed `resetPlans`, since it takes a list of paths.

```ts
// before
resetPlanAt(schema, ['grid', 'seed'], read);
// after
resetPlans(schema, ['grid', 'seed'], read);
```

<!-- entry: breaking api -->
