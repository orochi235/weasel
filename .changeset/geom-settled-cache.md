---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/diagram': patch
'@weasel-js/kernel3d': patch
---

`@weasel-js/geom/nd` exports `createSettledCache()`: a value built only once its source holds still. Each `read(key, build)` passes the source's key as a tuple; the first read at a new key answers null, and the second at the same key builds and keeps the value (`reads` moves which read builds it, and `reads: 1` makes it a plain memo). Keys match element by element under `Object.is`. This adds API.

Core's pick index, the diagram port and label indexes, and kernel3d's snap box index now use it, in place of three copies of that rule. They build at the same reads as before.
