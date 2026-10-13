---
'@weasel-js/animator': patch
---

A spring or a coast on a target, given no `onTick`, is no longer ticked every frame to ask whether it has come to rest. It is ticked when it first could be at rest, worked out from how fast its damping can take its energy away, and again each time that turns out to be too soon: a handful of ticks over its life, where there was one a frame. Retargeting or pushing it works the time out again. Nothing a caller sees changes: it shows the same values and ends on the same frame. One with an `onTick` is ticked every frame as before.
