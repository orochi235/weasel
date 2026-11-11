---
"@weasel-js/cursor": patch
---

`haloFitsInBox` and `rotationFitsInBox` read path numbers as SVG does: an exponent (`24e-1`), `.5`, and `1.5.5` all read correctly.

<!-- entry: rank=-5 fix -->
