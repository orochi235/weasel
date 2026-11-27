---
'@weasel-js/font': minor
---

`@weasel-js/font/sfnt` unpacks a `.ttc` collection or a `.dfont` into one face's standalone sfnt bytes, before any parser and without a browser.

It exports `sfntFromCollection(bytes, postScriptName?)`, which also lists every member's PostScript name, plus `isFontCollection`, `isDataForkFont` and `postScriptNameOf`.

<!-- entry: api new -->
