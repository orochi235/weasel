---
"@weasel-js/geom": patch
"@weasel-js/ui": patch
---

Items along a curved `Bar` or `Slider` no longer read upside down at the ends of an arc across 3 or 9 o'clock. A run still picks its side from its middle. A bar item, stop label or readout whose spot would tip it past 90° turns a half turn about its own center there, keeping its place in the run and its side of the band. Ticks, thumbs and the chevrons that mark more past an end keep the run's direction.

In geom, a `TrackPlace` carries `turned`, true where its up points down the screen: where an item that should read upright takes that half turn.
