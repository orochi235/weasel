---
'@weasel-js/ui': patch
---

`Timeline`'s own window follows `duration` until the user zooms in. The window was fixed at the first `duration` it saw, so a timeline mounted with `duration={0}` while its tracks loaded stacked every key at the left edge once the real duration arrived, and a key dragged past the end of an `AnimatedTimeline` was drawn off the track. A window the user zoomed is kept, and zooming all the way back out returns to following the duration. A controlled `window` is unchanged.
