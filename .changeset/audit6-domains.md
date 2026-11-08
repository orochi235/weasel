---
'@weasel-js/core': patch
---

Fix edge cases in core's feature domains found in a sixth audit pass:

- A long-press feedback entry installed on more than one canvas keeps each canvas's own press; before, the last canvas attached took over the ring and detaching any canvas blanked it on all of them.
- `usePoseRun` no longer commits a node a gesture took after the run's last frame when `stop()` lands.
- `workspaceTintLayer` keeps the mode's gradient when the page is scrolled out of the viewport, instead of switching to a solid wash.
- `composeSelectionPose` applies a leaf's resize overlay when it resolves a container's union over that leaf.
- The `resizable` chrome condition is exported from `@weasel-js/core`, beside the other chrome-caps atoms.
