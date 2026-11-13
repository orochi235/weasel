---
'@weasel-js/history': major
---

`History.currentEntryId()` is `nextEntryId()`: it always returned the id the next pushed entry will take, not one an entry already has.

```ts
// before
const forkPoint = history.currentEntryId();
// after
const forkPoint = history.nextEntryId();
```

<!-- entry: breaking api -->
