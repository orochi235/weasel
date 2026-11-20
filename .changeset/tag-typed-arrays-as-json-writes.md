---
'@weasel-js/geom': patch
---

`tagTypedArrays` copies an object as `JSON.stringify` writes it, through its `toJSON` or its own keys, so it tags and escapes the same values `typedArrayReplacer` does.

<!-- entry: fix data -->
