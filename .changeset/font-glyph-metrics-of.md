---
'@weasel-js/font': major
---

`metricsOf` is `glyphMetricsOf`: the `GlyphMetrics` of the tier a font resolved to.

```ts
// before
const metrics = metricsOf(cachedFontVariant(family, 400, 'normal'));
// after
const metrics = glyphMetricsOf(cachedFontVariant(family, 400, 'normal'));
```

<!-- entry: breaking api -->
