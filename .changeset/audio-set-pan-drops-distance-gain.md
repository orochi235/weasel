---
'@weasel-js/audio': patch
---

`setPan` on a voice played with a `position` drops that position's distance attenuation along with it, so the voice plays at its own gain like any explicitly panned voice.

<!-- entry: fix -->
