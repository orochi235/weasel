---
'@weasel-js/paint': major
'@weasel-js/core': major
---

`cycleFill` is renamed `paletteColorAt`: it returns the palette's n-th color as a hex string, wrapping past the end.

```ts
// before
const color = cycleFill(seq);
// after
const color = paletteColorAt(seq);
```

<!-- entry: breaking api -->
