---
'@weasel-js/hud': patch
---

A focused HUD button presses once when Space is released, as a native button does, rather than on Space's keydown and every auto-repeat.

Enter still presses on keydown. A Space released after focus left the button presses nothing.

<!-- entry: fix -->
