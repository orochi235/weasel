---
'@weasel-js/hud': patch
---

A HUD widget hears `cancel` for a press that never becomes a click or a drag.

That is a press a long-press took, one a second finger took for a pinch, or one the browser canceled. The `cancel` arrives when that pointer is released or lost, so a held button no longer stays lit and a held stepper chip stops repeating.

<!-- entry: fix -->
