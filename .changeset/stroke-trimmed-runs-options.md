---
'@weasel-js/stroke': major
---

`trimmedRuns` takes its two switches as an options bag, `{ dashed, byClosed }`, both defaulting to false, rather than two positional booleans.

```ts
// before
trimmedRuns(cut, true, true);
// after
trimmedRuns(cut, { dashed: true, byClosed: true });
```

<!-- entry: breaking api -->
