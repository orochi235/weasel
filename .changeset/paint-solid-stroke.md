---
'@weasel-js/paint': major
'@weasel-js/core': major
---

`strokeOf` is renamed `solidStroke`: it builds a solid stroke from a color, beside `strokeWith` for any paint.

```ts
// before
const stroke = strokeOf('#1c1c1c', 2);
// after
const stroke = solidStroke('#1c1c1c', 2);
```

<!-- entry: breaking api -->
