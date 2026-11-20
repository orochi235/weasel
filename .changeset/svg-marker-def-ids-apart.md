---
'@weasel-js/svg': patch
---

`serializeSvg` gives a sized or unseated marker def an id no marker key can spell, so each stroke keeps its own head.

Derived ids are now written with `--` (`arrow--s2`, `arrow--tip`), and a key holding `--` is written under a hashed id; files written before still read back.

<!-- entry: fix data -->
