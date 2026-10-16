---
'@weasel-js/geom': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Path edit can show balance lines: one per curved segment, from the tip of its first handle to the tip of its second, with a grip at the middle. Dragging a grip (`balanceHandles`) scales both handles together, each along its own direction, so the segment fills out or flattens without either end turning; double-clicking it (`equalizeHandles`) gives the two handles the same proportion of the way to the corner their lines meet at. Under a `pathSymmetry` dep the grip drag carries every image of both handles with it, as an anchor or handle drag does. The grip drag keeps every handle's angle, and a length lock in force for handle drags, from `handleLock.length` or Mod, holds it still. The lines and grips show, and the grips hit-test as `balance:N` affordances, while chrome-caps shows the new `path-edit.balance` id (`PATH_BALANCE_CHROME_ID`), which is off by default. Their look comes from the `<SceneCanvas>` layer slot `layers.pathEditingOverlay`'s new `balance` option. Both actions are in the standard actions and the `paths` feature preset. Additive.

`@weasel-js/routing` adds `isBalanceGrip`, and `isPathEditPart` now matches a balance grip too, so `move` turns a press on one down. `@weasel-js/geom` adds the geometry: `handleBalances`, `scaleSegmentHandles`, `balanceFactorToward`, and `equalizeSegmentHandles`.
