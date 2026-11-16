---
'@weasel-js/ui-input': patch
'@weasel-js/geom': patch
'@weasel-js/diagram': patch
'@weasel-js/animator': patch
'@weasel-js/loupe': patch
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
'@weasel-js/path-tools': patch
'@weasel-js/stroke': patch
'@weasel-js/forge': patch
---

Values held between two bounds go through geom's `clamp` and `clamp01` rather than local copies.

A loupe whose `minFactor` is above its `maxFactor`, and a curve editor's `xClamp` or `yClamp` given high bound first, now settle on the low bound, as `clamp` does, where they settled on the high one.

<!-- entry: rank=-5 behavior -->
