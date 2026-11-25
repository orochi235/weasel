---
'@weasel-js/routing': patch
---

`useHandleDrag` keeps a fixed handle's points right while a panel holding it scrolls, when the panel holds it through `will-change`, `backdrop-filter`, `container-type`, `content-visibility`, or the `translate`, `rotate`, and `scale` properties.

<!-- entry: fix -->
