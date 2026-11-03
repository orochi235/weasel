---
'@weasel-js/core': patch
---

An alt-drag clone snaps the way a move does: the copy lands where the snap sources hold it, the guides show while it drags, Ctrl suspends snapping and Shift locks the drag to an axis. `cloneAction` now requires the `snap` dep and declares `SNAP_ROLES`. The snapped offset is what the copy commits at and what Transform Again repeats.
