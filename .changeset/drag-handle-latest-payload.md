---
'@weasel-js/core': patch
---

`useDragHandle` reads the `getPayload` of its latest render when a drag crosses the threshold, not the one from when the press began.

<!-- entry: fix -->
