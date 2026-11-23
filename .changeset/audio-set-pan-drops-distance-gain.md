---
'@weasel-js/audio': patch
---

`setPan` on a voice played with a `position` drops that position's distance attenuation too. The voice then plays at its own gain, like any panned voice.

<!-- entry: fix -->
