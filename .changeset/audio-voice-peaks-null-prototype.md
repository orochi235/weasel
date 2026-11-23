---
'@weasel-js/audio': patch
---

`patternVoicePeaks` returns a null-prototype object, so reading a bus the pattern does not use gives `undefined` whatever the bus is named.

<!-- entry: fix -->
