---
'@weasel-js/quantity': patch
---

`endlessTrack` keeps infinity reachable on a range with no width and no step. With `min` equal to `max` its infinity stop used to sit on the range's own end, so a slider or spin field over it could never reach infinity. The stop now sits one unit out.
