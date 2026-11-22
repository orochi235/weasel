---
'@weasel-js/geom': patch
---

`pointAtLength` on a segment with no length answers its curved neighbor's direction where they meet, not that curve's chord.

<!-- entry: fix -->
