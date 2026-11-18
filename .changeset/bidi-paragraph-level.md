---
'@weasel-js/bidi': major
'@weasel-js/text': major
---

Bidi's `baseLevel` is `paragraphLevel`, the field it returns, and so is the `BidiEngine` method in `@weasel-js/bidi` and `@weasel-js/text`.

A custom engine passed to `registerBidi` or `layoutRuns` renames its method.

```ts
// before
const engine: BidiEngine = { analyze, reorder, mirror, baseLevel: (a) => a.paragraphLevel };
// after
const engine: BidiEngine = { analyze, reorder, mirror, paragraphLevel: (a) => a.paragraphLevel };
```

<!-- entry: breaking api -->
