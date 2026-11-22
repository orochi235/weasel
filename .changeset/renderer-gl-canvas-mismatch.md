---
'@weasel-js/renderer': patch
---

`new WeaselRenderer` throws when `canvas` is given beside a `gl` from a different canvas, where it sized one canvas and drew to the other.

<!-- entry: fix behavior -->
