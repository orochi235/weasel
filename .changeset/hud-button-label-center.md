---
'@weasel-js/hud': patch
---

A HUD button's label now sits centered in the button. It used to be placed as though the text's `y` were a baseline, but a text command's `y` is the top of the line, so the label hung from just below center and its descenders reached the bottom edge. The button now centers the laid-out line box in its height, the way a window's title bar already did.
