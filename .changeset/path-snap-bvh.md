---
'@weasel-js/geom': patch
---

`findPathSnaps` and `findPathSnap` look up a probe's targets and segments in a bounding-volume tree built the first time an index is asked, instead of scanning every target and segment of every path on each probe. A snap over many paths now costs what the paths near the probe cost. The hits are the same, in the same order. An axis whose `scale` is 0 now reaches every target along it for the tangent, perpendicular and nearest kinds too, as it already did for the rest.
