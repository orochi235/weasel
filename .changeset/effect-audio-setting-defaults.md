---
'@weasel-js/diagram': patch
---

An audio stage missing a discrete setting, such as a noise stage saved without its color, plays with its stage type's default.

An unknown wave, filter type or noise color is reported on its stage before any engine exists.

<!-- entry: fix -->
