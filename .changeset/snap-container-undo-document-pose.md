---
'@weasel-js/editing': patch
---

Undoing a `snapToContainer` drop of a node caught mid-reflow returns it to its document pose, not the pose the glide was showing.

<!-- entry: fix -->
