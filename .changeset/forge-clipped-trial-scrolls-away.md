---
'@weasel-js/forge': patch
---

A trial whose story an `overflow` ancestor clips away entirely now unmounts that story once a scroll carries it far from the viewport, and mounts it again on return. Before, the clipped story stayed mounted until something unclipped it, because the browser reports no further movement for an element of which nothing shows.
