---
'@weasel-js/geom': patch
---

`pathFromD` draws an arc whose radius is vastly larger than its chord as the near-straight curve it is, instead of leaving it out.

<!-- entry: fix visual -->
