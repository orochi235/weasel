---
'@weasel-js/core': patch
'@weasel-js/geom': patch
---

Average anchors is disabled where the selected anchors already sit on their mean or name no anchor of the path.

`averageAnchorsAt` returns false, changing nothing, when every anchor already sits on the mean.

<!-- entry: fix -->
