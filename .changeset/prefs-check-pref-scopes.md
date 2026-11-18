---
'@weasel-js/prefs': major
---

`checkPrefSplits` and `PrefSplitProblem` are renamed `checkPrefScopes` and `PrefScopeProblem`, after the `scopes` they validate.

```ts
// before
const problems: PrefSplitProblem[] = checkPrefSplits(schema);
// after
const problems: PrefScopeProblem[] = checkPrefScopes(schema);
```

<!-- entry: breaking api -->
