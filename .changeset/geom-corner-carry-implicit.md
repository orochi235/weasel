---
'@weasel-js/geom': patch
---

Corner specs carried through a split, rejoin or reversal stay on their own anchors in a path whose subpath opens after a `Z` without an `M`.

<!-- entry: fix -->
