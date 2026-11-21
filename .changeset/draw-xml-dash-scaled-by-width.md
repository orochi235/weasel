---
'@weasel-js/diagram-formats': patch
---

Draw-style XML keeps a dash's lengths when written and read. A written dash opens in a draw app at the lengths the diagram draws, and a dash read from a file is scaled by its stroke width, as the draw app drew it.

<!-- entry: fix data visual -->
