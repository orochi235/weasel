---
'@weasel-js/animator': patch
'@weasel-js/geom': patch
---

A clip can hold a path. `toClip` used to throw on a key whose value has a typed array in it, which is every `Path`. It now writes each one as its type's tag and its numbers, `{ __ta: 'f32', data: [...] }`, at any depth of the value, and `bindClip` makes it the typed array again, so a track tweening a path-shaped pose goes through `JSON.stringify` and `JSON.parse` and back. An event's `data` is passed as written, as before.

Changed behavior: `bindClip` now copies each key's value where it used to share it with the clip, so a plain object in a key's value that has `__ta` and `data` members of that shape is read as a typed array.

Adds API in `@weasel-js/geom`, where the encoding lives: `tagTypedArrays(value)` and `reviveTypedArrays(value)` copy a value with its typed arrays tagged or made again, `typedArrayReplacer` is the first as a `JSON.stringify` replacer, and `tagTypedArray` and `untagTypedArray` do one array. Every number array type is covered: `Int8Array` through `Float64Array`, `Uint8ClampedArray` included. The types are `TaggedTypedArray`, `TypedArrayTag`, and `NumberTypedArray`.
