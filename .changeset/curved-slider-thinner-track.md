---
'@weasel-js/ui': patch
---

A slider laid along a curve draws a thinner track by default: half the length of its stop ticks, which are now 14px whatever the track's thickness and can be set with `--rp-tick-length`. The default track was 24px. An explicit `trackHeight` still wins. The band's press area, the thumbs, and the labels below the track are sized from the larger of the track and the ticks, so none of them shrink with the visible track.
