---
'@weasel-js/core': patch
---

A custom layer anchored `after` or `before` another custom layer that has no anchor of its own now lands beside it. It was sent to the end of the stack with a warning naming a dangling reference, though the layer it named exists.
