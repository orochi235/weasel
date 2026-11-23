---
'@weasel-js/audio': patch
---

`patternVoicePeaks` returns a null-prototype object, so a bus the pattern does not use reads `undefined`.

<!-- entry: fix -->
