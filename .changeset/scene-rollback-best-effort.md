---
'@weasel-js/core': patch
---

A failed scene edit is taken back in full even when one of its ops throws on the way back.

The scene warns about that op, restores the selection, and rethrows the edit's original error.

<!-- entry: fix -->
