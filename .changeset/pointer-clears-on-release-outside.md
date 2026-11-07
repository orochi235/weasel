---
'@weasel-js/core': patch
---

A drag that ran off a canvas and was released outside it left the published pointer at the release point, so anything reading it afterward (a paste at the pointer, a hover readout) treated a pointer that had gone as still over the canvas. `usePublishPointer` now clears it on that release, as it already did when a free pointer left.
