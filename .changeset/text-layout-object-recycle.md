---
'@weasel-js/text': patch
---

A layout the caches recycle now hands its line boxes, and its paintings their groups and result objects, to the next layout and painting, so text rewritten every frame (a HUD readout) stops allocating them. A recycled layout's `lines` array and boxes belong to the next layout from then on; as before, only a layout no runs array files and no caller kept is recycled. The result of `cachedLayoutRuns` is still a new object for every layout. `paintRuns` and `layoutRuns` called directly return fresh objects as before.
