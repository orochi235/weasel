---
'@weasel-js/core': patch
---

`snapToContainer` waits out a `dwellMs` longer than 2³¹ − 1 ms, and an infinite one never snaps by dwell; both used to snap at once.

<!-- entry: fix -->
