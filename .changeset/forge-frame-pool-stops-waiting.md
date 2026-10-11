---
'@weasel-js/forge': patch
---

`Workshop`: the pool of warm frames for isolated stories no longer leaks a window listener for each frame that never loads. A frame that failed to load, as while the dev server restarts, also counted as loading for good, so the pool ran one short from then on; it is now dropped after 30 seconds and replaced.
