---
'@weasel-js/stroke': patch
---

A round join where a path turns exactly 180° draws its half disc around the tip. The tessellator read a turn of exactly 180° as no turn at all, so a line that doubled straight back ended flat there, as if butt-capped.
