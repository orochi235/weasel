---
'@weasel-js/core': patch
---

Two unrelated presets giving one layer slot, tool, chrome rule, selection or selection chrome different values now always throw, whatever order the presets come in.

A third preset that agrees with one of them and refines the other no longer hides the conflict. Have one of the two name the other in `refines` to settle it.

<!-- entry: fix behavior -->
