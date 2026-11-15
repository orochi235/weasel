---
'@weasel-js/gestures': minor
---

`isContextPress(e)` says whether a press opens the context menu: the secondary button, or Ctrl with the primary one on an Apple platform.

A drag that starts on a primary press can skip one, so the `contextmenu` that follows still reaches its element:

```ts
if (!isPrimaryPress(e) || isContextPress(e)) return;
```

<!-- entry: rank=0 api -->
