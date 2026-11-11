---
"@weasel-js/forge": patch
---

A paused playhead held in the URL past 1e21 seconds reads back. `parseSeconds` reads the exponent `formatSeconds` writes there, and refuses a number of seconds too large for a finite ms rather than returning `Infinity`.

<!-- entry: rank=-5 fix -->
