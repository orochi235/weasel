---
'@weasel-js/paint': major
'@weasel-js/core': major
---

`parseColorToRgba255` is renamed `parseColorBytes`, matching `parseHexBytes` and `hexToRgbBytes`, the other readers that return 0..255 channels.

```ts
// before
const [r, g, b, a] = parseColorToRgba255(css);
// after
const [r, g, b, a] = parseColorBytes(css);
```

<!-- entry: breaking -->
