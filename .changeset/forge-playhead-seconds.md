---
"@weasel-js/forge": patch
---

A paused playhead held in the URL past 1e21 seconds reads back: `formatSeconds` writes such a time with an exponent, which `parseSeconds` now reads. `parseSeconds` refuses a number of seconds too large for a finite ms rather than returning `Infinity`.
