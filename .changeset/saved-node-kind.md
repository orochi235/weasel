---
'@weasel-js/core': major
---

`nodeKindOf` is `savedNodeKind`: it answers the kind a saved node loads as, `'mark'` or `'group'`.

```ts
// before
const kind = nodeKindOf(2, saved);
// after
const kind = savedNodeKind(2, saved);
```

<!-- entry: breaking api -->
