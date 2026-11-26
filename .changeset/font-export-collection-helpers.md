---
'@weasel-js/font': minor
---

`@weasel-js/font` exports its font collection helpers: `isFontCollection`, `isDataForkFont`, `sfntFromCollection` and the new `collectionNamesOf`.

`sfntFromCollection(bytes, postScriptName?)` cuts one member out of a `.ttc` or `.dfont` as a standalone font. `collectionNamesOf(bytes)` lists every member's PostScript name in file order without cutting any out, with `null` for a member that carries none, and is empty for a single font.

<!-- entry: api -->
