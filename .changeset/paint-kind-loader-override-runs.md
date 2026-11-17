---
'@weasel-js/renderer': patch
'@weasel-js/paint-kinds': patch
---

A paint-kind loader declared over one that already started or failed is the one the next lookup calls.

A load the displaced loader finishes afterward registers nothing.

<!-- entry: fix -->
