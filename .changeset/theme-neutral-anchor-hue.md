---
'@weasel-js/theme': patch
---

A lightness ramp anchored on white, black, or a gray no longer passes through an unrelated hue on the steps toward its other anchor.

A neutral anchor takes the hue of its nearest chromatic anchor, or the ramp's `hue` when every anchor is neutral.

<!-- entry: fix visual -->
