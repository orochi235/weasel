---
"@weasel-js/ui": minor
---

`useFitScope` takes an `overflows` option, for a scope whose content does not overflow its box the usual way, such as items laid along a curve.

```ts
const fit = useFitScope(ref, { overflows: (el) => runLength(el) > room });
```

<!-- entry: api -->
