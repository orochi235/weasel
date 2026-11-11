---
"@weasel-js/geom": patch
"@weasel-js/editor": patch
---

`@weasel-js/geom` exports `isRawWrapper`, the `RawWrapper` type, and `typedArrayReplacerWrapping`, a `JSON.stringify` replacer that also wraps whatever values a caller's own reader would misread. `typedArrayReplacer` is that replacer with nothing extra to wrap, and `@weasel-js/editor`'s `serializeReplacer` and `reviveTypedArrays` now build on these rather than keeping a copy of the `{ "__raw": … }` wrapper. One edge changes in the editor: a non-plain object (a class instance) whose only key is `__raw` is no longer wrapped.
