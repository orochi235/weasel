---
'@weasel-js/core': patch
---

A presentation's step keys pass through to the next binding on them when there is no page to step to, at either end without `wrap`.

`present.step` and `present.go` now report disabled for any request naming no page, including a `present.go` to an id or index the deck lacks.

<!-- entry: fix -->
