---
"@weasel-js/cursor": patch
---

`haloFitsInBox` and `rotationFitsInBox` read path numbers as `placeCursorPath` and SVG do: a number with an exponent (`24e-1`) no longer throws as a relative `e` command, and `.5` and `1.5.5` no longer read as `5`, which let a point on the box's edge pass as inside it.
