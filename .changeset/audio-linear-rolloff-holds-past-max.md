---
'@weasel-js/audio': patch
---

`spatialize`'s linear rolloff stops falling at `maxDistance`, as a `PannerNode`'s does, holding `1 − rolloffFactor` beyond it.

<!-- entry: fix -->
