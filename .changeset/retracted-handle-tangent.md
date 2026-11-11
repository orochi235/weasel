---
"@weasel-js/geom": patch
---

`pointAtLength` at the end of a curve whose handle there is retracted gives the curve's own direction, not its chord's.

<!-- entry: rank=-5 fix -->
