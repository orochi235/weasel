---
'@weasel-js/paint': patch
---

`parsesAsColor` reads every CSS named color, such as `coral` and `rebeccapurple`, where there is no `CSS.supports` (SSR, workers, jsdom).

<!-- entry: fix -->
