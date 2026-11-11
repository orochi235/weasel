---
"@weasel-js/geom": patch
"@weasel-js/headless": patch
---

`reviveTypedArrays` reads back a plain object shaped like a tagged typed array or a `{ "__raw": … }` wrapper as that plain object. `tagTypedArrays` and `typedArrayReplacer` write such an object inside a `{ "__raw": … }` wrapper, the one `@weasel-js/editor`'s snapshots already use, which `reviveTypedArrays` takes off without reading into what it holds. Everything else is written exactly as before, so older files read the same, unless one holds a plain object whose only key is `__raw`. `sceneToWire` in `@weasel-js/headless` still takes a snapshot whose arrays are already tagged.

<!-- entry: fix data -->
