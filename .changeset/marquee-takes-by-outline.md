---
'@weasel-js/core': patch
---

A marquee and a lasso now agree on a node whose pose descriptor bounds reach past what it draws. A marquee took such a node as soon as its bounds overlapped the rect, and an enclosing lasso refused it when its bounds poked out; both now decide by the drawn outline, as an `intersect` lasso already did.

Changes behavior: a node whose descriptor (`forNode` included) reports a box larger than its painter's silhouette is no longer taken by a marquee over the part of that box where nothing is drawn. Give the node a painter whose `silhouette` covers what it draws.
