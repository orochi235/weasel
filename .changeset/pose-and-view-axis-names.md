---
'@weasel-js/core': patch
---

Adds axis names to the kit's own targets, so a hold or a track on one can say `axes: ['y']` where it had to say `axes: [1]`. A rect pose's axes are `x`, `y`, `width`, `height`, and `rotation`; a rect path pose's are the first four; the view's are `x`, `y`, `scale.x`, and `scale.y`, so `'scale'` names both. A polygon path pose's axes are its coordinates and stay indexes.
