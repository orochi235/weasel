---
'@weasel-js/labkit': patch
---

Reset opens a `useTrialScene` trial on the selection its `create`d scene holds, as a fresh trial does.

A scene that selects nothing keeps the selection made outside it, such as `useSelection`'s `initial`, on the nodes that come back.

<!-- entry: fix -->
