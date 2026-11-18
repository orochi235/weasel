---
'@weasel-js/hud': major
---

`Hud.markDirty()` is `Hud.requestRedraw()`, the name the kit's hosts use; it asks the host to paint and sets no flag.

```ts
// before
hud.markDirty();
// after
hud.requestRedraw();
```

<!-- entry: breaking api -->
