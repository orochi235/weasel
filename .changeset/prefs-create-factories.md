---
'@weasel-js/prefs': major
---

prefs' factories are spelled `create…`, like every other factory. `prefsDefaultsSource`, `prefWeightAxes` and `prefAliasTargets` are renamed `createDefaultsSource`, `createWeightAxes` and `createAliasTargets`.

```ts
// before
const axes = prefWeightAxes(schema);
// after
const axes = createWeightAxes(schema);
```

<!-- entry: breaking api -->
