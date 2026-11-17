---
'@weasel-js/prefs': major
---

`prefIsReset` is renamed `prefIsAtReset`, matching the other `…IsAtReset` checks.

```ts
// before
prefIsReset(leaf, { auto, value });
// after
prefIsAtReset(leaf, { auto, value });
```

<!-- entry: breaking api -->
