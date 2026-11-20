---
'@weasel-js/gestures': patch
---

`fixedSeat` places a drag ghost correctly under an ancestor that contains fixed elements without a `transform`.

That covers the individual `scale`, `translate` and `rotate` properties, `will-change: transform`, any `container-type`, and `content-visibility: auto`.

<!-- entry: fix -->
