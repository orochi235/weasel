---
'@weasel-js/stroke': major
---

`inkWidth` is renamed `widthHasInk`, since it answers whether a ribbon of that width has anything to draw.

```ts
// before
if (inkWidth(width)) draw();
// after
if (widthHasInk(width)) draw();
```

<!-- entry: breaking api -->
