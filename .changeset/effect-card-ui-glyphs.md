---
'@weasel-js/ui': patch
---

`EffectCard`'s duplicate and remove buttons draw ui's own `clone` and `close` glyphs, in place of editing's `duplicate` and core's `delete`.

A registry holding only ui's table now draws them, where before it drew two question marks.

<!-- entry: fix -->
