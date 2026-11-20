---
'@weasel-js/registry': patch
---

Ending a subscription to an extension registry no longer ends the same listener's own subscription to its parent or to its `own` reflection.

<!-- entry: fix -->
