---
"@weasel-js/kernel3d": patch
---

`projectPoint` and `projectAabbToScreen` draw nothing through a pane with no area or a camera whose near plane is its far one, and `projectAabbToScreen` gives `null` rather than a box of `NaN` under a zero field of view. Both used to answer a pixel or a box there, though `rayAt` names no ray through either.
