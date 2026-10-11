---
'@weasel-js/core': patch
---

Duplicate and Alt-drag clone point a copied node's `dependsOn` id list at the copies when every node in the list was copied with it, so a duplicated edge follows the duplicated endpoints instead of the originals. A copy with a dependency left out keeps its original list, as before.
