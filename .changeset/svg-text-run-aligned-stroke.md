---
'@weasel-js/svg': patch
---

Exporting a text node with an inner or outer stroke draws that stroke on runs that set no stroke of their own, as the canvas does.

<!-- entry: fix visual -->
