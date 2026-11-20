---
'@weasel-js/hud': patch
---

A HUD window's drag goes on when its `onMove` or `onResize` calls `setBounds` to snap or constrain it.

A `setBounds` from anywhere else still ends a drag in flight.

<!-- entry: fix -->
