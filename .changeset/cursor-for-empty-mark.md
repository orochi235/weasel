---
"@weasel-js/cursor": patch
---

`cursorFor` keys a cursor with a mark apart from one without, so a mark named `''` throws as an unknown mark every time, where after the plain glyph had been baked it answered the plain cursor from the cache.
