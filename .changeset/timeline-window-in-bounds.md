---
"@weasel-js/ui": patch
---

A timeline zoomed or panned against an end of its bounds no longer starts or ends a rounding error outside them, and a pan of nothing gives back the window it was given instead of one an ulp off.
