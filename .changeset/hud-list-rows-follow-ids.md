---
'@weasel-js/hud': patch
---

A HUD list's keyboard, hovered and pressed rows stay on their rows when `setRows` inserts or reorders them.

Enter or a release activates the row it was on.

A removed keyboard row hands the keyboard to the row now in its place; a removed pressed row activates nothing on release.

<!-- entry: fix -->
