---
'@weasel-js/prefs': major
---

`scopedPrefUnit` and `prefLeafInScopes` are renamed `unitScopedPrefUnit` and `prefLeafInUnitScopes`: the scopes they apply are unit scopes.

```ts
// before
const leaf = prefLeafInScopes(field, scopes);
// after
const leaf = prefLeafInUnitScopes(field, scopes);
```

<!-- entry: breaking api -->
