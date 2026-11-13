---
'@weasel-js/paint': major
'@weasel-js/core': major
---

`resolveColor` is gone; `parseColor` and `tryParseColor` now return the read-only tuple it did, since all three share one cache.

```ts
// before
const [r, g, b, a] = resolveColor(css);
// after
const [r, g, b, a] = parseColor(css);
```

A caller that wrote into `parseColor`'s result copies it first: `[...parseColor(css)]`.

<!-- entry: breaking -->
