---
"@weasel-js/svg": patch
---

`serializeSvg`, `escapeText`, and `escapeAttr` write a character XML cannot hold (a control character, U+FFFE, U+FFFF, or half a surrogate pair) as U+FFFD instead of dropping it, and `serializeSvg` warns once through `onWarn` when its input held one.
