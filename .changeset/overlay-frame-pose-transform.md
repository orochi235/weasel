---
'@weasel-js/core': patch
---

Fixes: `useNodeOverlayFrame` applied a pose's rotation and left out its `transform`, so DOM chrome over a skewed or stretched node, the gradient handles among them, sat on the unstretched box. `toScreen` and `toLocal` now go through the pose's whole frame, and the hook answers `null` for a pose whose `transform` is singular, which draws nothing.
