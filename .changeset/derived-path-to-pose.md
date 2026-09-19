---
'@weasel-js/core': patch
---

A `<SceneCanvas>` scene slot with its own `toPose` now derives paths from the poses that `toPose` paints dependencies at. Before, `derivePath` was handed the scene's poses while the nodes it connects were painted through `toPose`, so a derived edge could miss its endpoints. The clip a derived container imposes follows the same rule. No API change.
