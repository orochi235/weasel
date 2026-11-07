---
'@weasel-js/paint': patch
---

`lerpPaint` keeps each gradient stop's alpha. Interpolating two gradients dropped it, so a stop that faded to transparent came back opaque, at every `t` including 0 and 1.
