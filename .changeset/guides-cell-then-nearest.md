---
'@weasel-js/guides': major
---

The `cellAt` snap policy is `cellThenNearest`: it picks the cell under the pointer, else the nearest target.

```ts
// before
tileGrid({ snap: cellAt() });
// after
tileGrid({ snap: cellThenNearest() });
```

<!-- entry: breaking api -->
