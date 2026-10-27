---
'@weasel-js/routing': patch
---

A drag's `screenDelta` is now measured in the surface's own pixels, through the host's `clientToLocal` when it supplies one. A drag pan on a canvas under a scaled ancestor used to move the view by the pointer's travel in client pixels, so under `scale(2)` the content ran twice as far as the pointer; it now moves with the pointer. A host with no `clientToLocal` sees no change. An action's `dragThresholdPx` is measured the same way.
