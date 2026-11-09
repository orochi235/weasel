---
"@weasel-js/gestures": patch
---

`fixedSeat` now answers the corner of whichever of the host and its ancestors contains fixed descendants (a transform, filter, or containment), so a drag ghost lands under the pointer when the transform sits above the themed host or on the body.
