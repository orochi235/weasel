---
"@weasel-js/ui": patch
---

`BandEditor`'s range edge stays exactly where it is when every band is locked. The locked lengths' sum could round off and move the edge by a hair, so a drag that changed nothing still rewrote the bands.
