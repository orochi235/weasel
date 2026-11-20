---
'@weasel-js/p-touch': patch
---

A text box the canvas lays out right to left is drawn into the `.lbx` as an image, so `start` and `end` stay on its side.

That covers a style `direction` of `rtl` and an `auto` paragraph whose first strong letter reads right to left.

<!-- entry: fix data -->
