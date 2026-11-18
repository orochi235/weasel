---
'@weasel-js/guides': major
---

The snap policies `none` and `nearest` are `noSnap` and `nearestSnap`, so they say what they are where they are imported.

```ts
// before
freeform({ snap: none() }); pack({ snap: nearest() });
// after
freeform({ snap: noSnap() }); pack({ snap: nearestSnap() });
```

<!-- entry: breaking api -->
