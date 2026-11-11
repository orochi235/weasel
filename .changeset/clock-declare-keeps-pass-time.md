---
"@weasel-js/clock": patch
---

A `declare` that keeps a clock's origin leaves the time within its pass exactly as it was, so it no longer lets go of a hold. A clock at a pass's end also keeps that pass through a `loop` write where the end does not divide evenly.

<!-- entry: rank=-5 fix -->
