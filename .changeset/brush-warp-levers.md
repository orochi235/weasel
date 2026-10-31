---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

The Smudge brush, the Simplify brush, a warp's control drag, and Warp Settings can be the last operation, their
settings changed after the fact in the last-operation panel. A brush stroke replays every dab from its start with the
new Size, Strength or Tolerance; text the Smudge brush converted is put back and converted again wherever the brush
at its new size meets it. A warp drag replays with the warp remade under the new Mode, Rows, Columns, Mapping or
Tolerance, the control moved as it was first, so an envelope's new grid is resampled from the mesh the drag bent.
Warp Settings shows only the settings a run changed. Each stays one undo entry.

A tool's options and its action's panel are one setting: `ActionTuning.keep` is handed the params a panel change set,
and the tuning `<SceneCanvas>` makes from `toolOptionValues` writes them back there, so an options row shows the
values the next stroke uses. `OngoingHandle.params` reports params a gesture took from what it edited rather than
from its binding, such as a held warp's own grid, which the panel shows and replay receives. A gesture that opens a
journal as it starts is now kept as the last operation. `SMUDGE_BRUSH_PARAMS` and `SIMPLIFY_BRUSH_PARAMS` are the
forms the brushes' options use, and `warpDragParams`, `configureWarpParams`, and `WARP_SETTING_FIELDS` the warps'.
