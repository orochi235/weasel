---
"@weasel-js/geom": patch
"@weasel-js/editor": patch
---

`@weasel-js/geom` exports the `{ "__raw": … }` wrapper that keeps lookalike values from being misread on load. `isRawWrapper` and the `RawWrapper` type test for it, and `typedArrayReplacerWrapping` is a `JSON.stringify` replacer that also wraps whatever values a caller's own reader would misread. `typedArrayReplacer` is that replacer with nothing extra to wrap. `@weasel-js/editor`'s `serializeReplacer` and `reviveTypedArrays` build on these.

<!-- entry: api -->
