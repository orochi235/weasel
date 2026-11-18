---
'@weasel-js/labkit': patch
---

Reset in a `TrialSceneCanvas` lab reopens the path its `defaultPathEdit` opens, or closes the open path when it has none.

A Reset used to leave whatever path was open in anchor edit, since the trial stays mounted and `defaultPathEdit` applied only on mount.

<!-- entry: fix -->
