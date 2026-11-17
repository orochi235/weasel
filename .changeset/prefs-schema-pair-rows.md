---
'@weasel-js/prefs-schema': major
'@weasel-js/prefs': major
---

`pairRowsOf` is renamed `prefPairRows`, like every other prefs-schema export.

```ts
// before
const rows = pairRowsOf(leaves);
// after
const rows = prefPairRows(leaves);
```

<!-- entry: breaking api -->
