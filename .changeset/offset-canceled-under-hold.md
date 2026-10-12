---
'@weasel-js/core': patch
---

Canceling a tween, spring, or coast on a target that has a hold no longer moves the value on screen. What the canceled animation had left to travel was added to the committed value, which a hold stands in front of, so at full weight it vanished. It now stays on screen beside the hold. It is committed when the target's last hold is released, taken up by the next tween or spring given a destination, and dropped by `target.stop({ commit: false })`.

**This changes when `set` is called**: for an animation canceled under a hold, the target's `set` runs as the last hold leaves, not at the cancel.
