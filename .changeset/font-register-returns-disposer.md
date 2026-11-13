---
'@weasel-js/font': minor
'@weasel-js/core': minor
---

`registerFontOutlines` and `registerCanvasFont` return a function that takes the registration out again, as `registerBidi`, `registerShaper` and `registerDisplayKind` do.

A registration a later one replaced is left alone, so the function is safe to call from an effect's cleanup:

```ts
useEffect(() => registerFontOutlines('Inter', { weight: 700 }, '/fonts/inter-bold.ttf'), []);
```

<!-- entry: api -->
