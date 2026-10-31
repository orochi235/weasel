---
"@weasel-js/path-tools": patch
---

More path tools leave the last-operation panel up after they run, holding the values they read:

- Lengthen (`lengthenPath`, a drag): Shape, straight, arc, or eased (`LENGTHEN_PATH_PARAMS`).
- Girth (`girth.drag`, a drag): Grab reach and One edge only (`GIRTH_DRAG_PARAMS`, `GirthDragParams`). The drag
  action's label is now "Stroke width", its undo entry's. `useGirthTool`'s `reach` option, when given, wins over
  the reach the panel last set.
- Corner radius (`editCorner`, a drag): Shape for sharp corners (`EDIT_CORNER_PARAMS`). The corner controls' Shape
  options are now labeled ("Round" rather than "round"), from the shared `CORNER_SHAPE_OPTIONS`.
- Next corner shape (`cycleCornerShape`): Size for sharp corners, the share of a corner's room its new shape cuts
  (`CYCLE_CORNER_SHAPE_PARAMS`).
- Link anchor (`linkAnchor`, a drag): Reach (`LINK_ANCHOR_PARAMS`). A replay that misses every target leaves a
  plain move.
- Trim segment (`trimPath`): Reach (`TRIM_PATH_PARAMS`). Extend to next path's form gains Reach too.

Each drag replays the gesture as it ended with the new values, as one undo entry.
