---
"@weasel-js/clock": patch
---

A ramp reaches its rate exactly once its time is up, where frames whose times add up to it left it a few ulps short, at `1.9999999999999998` for `2`. A `declare` that keeps the origin leaves the time within the pass exactly as it was; the round trip through the shown time could move it by an ulp, which let go of a hold. A clock standing at a pass's end keeps that pass through a `loop` write where the end does not divide evenly.
