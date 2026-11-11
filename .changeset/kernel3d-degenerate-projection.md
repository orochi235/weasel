---
"@weasel-js/kernel3d": patch
---

`projectPoint` and `projectAabbToScreen` draw nothing through a pane with no area or a camera whose near plane is its far one. `projectAabbToScreen` gives `null` under a zero field of view.

<!-- entry: rank=-5 fix -->
