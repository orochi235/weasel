---
"@weasel-js/plot": patch
---

`bandScale` takes its default padding for a `paddingInner` of `NaN` and a `paddingOuter` that is not finite, rather than placing every band at `NaN`.
