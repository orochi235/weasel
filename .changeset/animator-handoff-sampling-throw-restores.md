---
'@weasel-js/animator': patch
---

A compositor tween or spring whose `style`, `interpolator`, or `easing` throws as its keyframes are made puts back the committed value it found.

This holds for a spring's `setTarget` too, which keeps running toward its old destination.

<!-- entry: fix -->
