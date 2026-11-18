---
'@weasel-js/prefs': major
---

A source's `stateAt` returns a `PrefLeafStatus`: `PrefStatus`'s `shown` and `enabled`, plus `active`. It replaces `LeafState`, and `FREE_LEAF_STATUS` replaces `LEAF_FREE`.

```ts
// before
stateAt: (path): LeafState => ({ disabled: !on(path), hidden: !seen(path), active: false }),
const free = LEAF_FREE;
// after
stateAt: (path): PrefLeafStatus => ({ enabled: on(path), shown: seen(path), active: false }),
const free = FREE_LEAF_STATUS;
```

<!-- entry: breaking api -->
