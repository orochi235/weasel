---
'@weasel-js/renderer': patch
---

A `WeaselRenderer` that fails to construct on a lost context no longer rebuilds itself, unowned, when the context comes back.

<!-- entry: fix -->
