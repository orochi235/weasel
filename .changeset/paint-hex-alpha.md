---
'@weasel-js/paint': major
'@weasel-js/core': major
---

`getAlpha01` is renamed `hexAlpha`, the alpha of a hex color, beside `paintAlpha` for a paint.

```ts
// before
const a = getAlpha01('#ff000080');
// after
const a = hexAlpha('#ff000080');
```

<!-- entry: breaking api -->
