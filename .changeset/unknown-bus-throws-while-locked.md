---
'@weasel-js/audio': patch
---

Playing on a bus the engine does not have throws before the context is unlocked and after dispose too, rather than dropping the voice as `locked` or `disposed`.

<!-- entry: fix -->
