---
'@weasel-js/ui': patch
---

In a `createKeyframeLayer` layer, moving a key past its neighbor left `selectedSegment` naming a different segment, so the highlighted band and its bezier handles jumped. `applyKeyframeDrag` now returns `selectedSegment` too, following the key the segment runs into, and it is `null` when that key becomes the first.
