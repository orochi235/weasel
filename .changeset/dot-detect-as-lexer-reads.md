---
'@weasel-js/diagram-formats': patch
---

DOT detection recognizes every graph header the DOT reader reads, including an HTML id holding `//` or `/*` and a quoted id joined with `+`.

<!-- entry: fix -->
