---
"@weasel-js/svg": patch
---

`serializeSvg`, `escapeText` and `escapeAttr` write a character XML cannot hold as U+FFFD instead of dropping it.

That covers control characters, U+FFFE, U+FFFF and half a surrogate pair; `serializeSvg` warns once through `onWarn` when its input held one.

<!-- entry: fix -->
