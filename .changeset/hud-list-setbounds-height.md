---
'@weasel-js/hud': minor
---

A HUD list keeps the height `setBounds` gives it, clipping and scrolling its rows as a list created with `height` does.

Leave `height` out of `setBounds` to move or widen a list while it stays as tall as its rows:

```ts
list.setBounds({ x: 40, y: 20, width: 240 });               // follows its rows
list.setBounds({ x: 40, y: 20, width: 240, height: 120 });  // fixed at 120 px, scrolls
```

<!-- entry: fix api behavior -->
