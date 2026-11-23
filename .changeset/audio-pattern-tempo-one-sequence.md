---
'@weasel-js/audio': patch
---

A pattern player's `setTempo`, called from a scheduler callback due beside its next step, no longer plays every step twice.

<!-- entry: fix -->
