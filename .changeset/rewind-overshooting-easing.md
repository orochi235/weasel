---
'@weasel-js/core': patch
---

A `rewind: true` tween under an overshooting easing travels the rest of the way when undone or redone mid-flight, not snapping to the end.

The overshooting easings include `easeOutBack` and `easeInBack`.

<!-- entry: fix -->
