---
"@weasel-js/text-shaping": patch
---

`shape` no longer answers one request with another's cached glyphs when a NUL at the end of the language or the start of the text, or a comma inside a feature setting, made their cache keys run together: `shape(face, 'م', [], 'sd\0')` after `shape(face, '\0م', [], 'sd')` drew two glyphs for one letter. A feature setting it cannot read is now refused every time, not only when nothing like it was shaped first.
