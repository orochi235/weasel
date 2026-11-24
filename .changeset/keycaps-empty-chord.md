---
'@weasel-js/ui': patch
---

`keyLegendsFromChord` reads an empty chord as no keys, so a `KeySequence` shows its empty placeholder, not a blank keycap.

<!-- entry: fix -->
