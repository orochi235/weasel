---
'@weasel-js/routing': patch
---

`useHandleDrag` ignores a scroll between a `position: absolute` rect and its containing block, which does not move the rect, so its reported points no longer jump by that scroll.

<!-- entry: fix -->
