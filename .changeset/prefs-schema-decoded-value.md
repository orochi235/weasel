---
'@weasel-js/prefs-schema': major
'@weasel-js/prefs': major
---

`prefShownValue` is renamed `prefDecodedValue`: it reads a stored value through the leaf's `encoding`, with no fallback to the default.

```ts
// before
const shown = prefShownValue(leaf, stored);
// after
const shown = prefDecodedValue(leaf, stored);
```

<!-- entry: breaking api -->
