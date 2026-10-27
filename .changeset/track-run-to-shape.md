---
'@weasel-js/geom': patch
'@weasel-js/ui': patch
---

A `TrackRun` has `toShape(g)`, the fraction along its underlying shape that reading fraction `g` falls at. This adds a required member to the `TrackRun` interface, so an object built by hand to satisfy it needs one too. `Jog` reads left to right in a right-to-left locale as well, curved or straight, as playback controls do; its caption takes its own text's direction.
