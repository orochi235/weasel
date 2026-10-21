---
'@weasel-js/core': patch
---

A node that shows a derived path is boxed around that path, stroke included, wherever the kit measures a drawn box: selection chrome, its hit regions, and the actions that read `drawnBoxes`. Its zero-size placeholder pose no longer drags the box back to the origin. `DrawnBoundsScene` takes an optional `derivedPathOf`, and `drawnBoundsScene(scene)` supplies it for a `Scene`; pass a scene through it to `useAlign`'s `scene` for the same box there.
