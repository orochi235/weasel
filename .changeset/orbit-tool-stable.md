---
'@weasel-js/kernel3d': patch
---

`useOrbitTool` returns the same tool on every render, as the kit's other tool hooks do. It built a new one each call, which — now that a tool redefined under the same id replaces the old one — rebuilt the canvas's tools every render and looped any canvas whose `onToolsCreated` sets state.
