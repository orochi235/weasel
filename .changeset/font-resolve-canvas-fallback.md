---
'@weasel-js/font': major
---

`resolveGlyphFallback` is `resolveCanvasFallback`: it resolves a face's canvas tier and takes no glyph.

```ts
// before
const fallback = resolveGlyphFallback(family, 400, 'normal');
// after
const fallback = resolveCanvasFallback(family, 400, 'normal');
```

<!-- entry: breaking api -->
