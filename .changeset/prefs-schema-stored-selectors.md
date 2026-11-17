---
'@weasel-js/prefs-schema': major
'@weasel-js/prefs': major
---

`prefScopeSelectors` is renamed `prefStoredSelectors`: it reads the selectors a stored value is split by, not the ones a pref declares.

```ts
// before
const by = prefScopeSelectors(held);
// after
const by = prefStoredSelectors(held);
```

<!-- entry: breaking api -->
