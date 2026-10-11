---
'@weasel-js/hud': patch
---

The hud loupe reported `#000000` as the color under the aim over a transparent pixel, where `@weasel-js/loupe`'s canvas source reports no color. `loupe.color`, `onColorChange`, and `pick` now answer `null` there.
