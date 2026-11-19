---
'@weasel-js/core': patch
---

A `tweenPose` with `rewind` and an overshooting easing, undone and redone mid-flight, runs out its time instead of snapping to an end

Turned around inside an easing's overshoot (`easeOutBack` past its destination, `easeInBack` behind its start), it carries on along the positions it passed and calls `onDone` only once it arrives.

<!-- entry: fix -->
