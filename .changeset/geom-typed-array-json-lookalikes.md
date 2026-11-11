---
"@weasel-js/geom": patch
"@weasel-js/headless": patch
---

`tagTypedArrays` and `typedArrayReplacer` write a plain object that `reviveTypedArrays` would take for a tagged typed array (`{ "__ta": "u8", "data": [] }`), or for a `{ "__raw": … }` wrapper, inside such a wrapper, and `reviveTypedArrays` takes the wrapper off and reads nothing into what it holds. Such an object used to come back as a typed array. This is the wrapper `@weasel-js/editor`'s snapshots already use. Everything else is written exactly as before, so older files read the same, unless one holds a plain object whose only key is `__raw`. `sceneToWire` in `@weasel-js/headless` still takes a snapshot whose arrays are already tagged.
