---
'@weasel-js/routing': patch
---

`useHandleDrag` follows a scroll of a panel holding a fixed handle through `will-change`, `backdrop-filter`, or `container-type`. The same goes for `content-visibility`, `translate`, `rotate`, and `scale`.

<!-- entry: fix -->
