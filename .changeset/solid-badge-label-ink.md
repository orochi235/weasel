---
"@weasel-js/ui": patch
---

A solid `Badge` now picks its label ink from its fill: white on a dark fill, near-black on a light one. White used to be the label on every status, and on the info, success, warn and light-mode neutral fills, and dark-mode accent, it measured under 3:1. Those labels now read dark, at 6.8:1 or better. Every status clears 4:1 in both modes. The ink follows whatever fill is painted, so a tone or stance that repaints the fill no longer keeps a fixed white.
