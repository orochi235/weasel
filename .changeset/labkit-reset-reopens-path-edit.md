---
'@weasel-js/labkit': patch
---

Reset in a `TrialSceneCanvas` lab reopens the path its `defaultPathEdit` opens.

A Reset used to leave whatever path was open in anchor edit, since the trial stays mounted and `defaultPathEdit` applied only on mount. A canvas with no `defaultPathEdit` leaves path edit as it is, since a `pathEdit` host such as `usePathEditMode` owns what it opened.

<!-- entry: fix -->
