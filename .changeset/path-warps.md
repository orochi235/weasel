---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

Three warp tools bend the selected paths and keep the warp editable until it is expanded. `useDistortTool` drags the four corners of the selection's box on their own, mapped bilinearly (`mode: 'free'`) or projectively (`'perspective'`, which keeps straight lines straight). `useEnvelopeTool` drags the points of a mesh over the box (`rows`, `cols`), interpolated as a bicubic surface or as one Coons patch per cell (`mapping`). `usePuppetTool` pins a path where it is clicked and bends it when a pin is dragged, moving everything else as rigidly as the pins allow; Alt-click takes a pin out. Pass them through `<SceneCanvas tools>`; their keys are F, M, and B, and `keybinding` overrides or (with `null`) omits one. Their drag and pin actions read the same settings as params, so `<SceneCanvas tune>` can set them too.

A warp is held on each path as `data.warp`, beside the geometry it made, and survives moving, resizing and rotating the node. Two new actions in the `paths` preset work on whatever warp the selection holds: `expandWarp` drops it, leaving plain geometry, and `configureWarp` remakes it with new settings. Editing the path's anchors, or any path command, also drops it. `withPathWarp` builds a node that opens already warped; `heldPathWarpOf` and `resolvePathWarp` read one back.

`@weasel-js/geom` adds the maps underneath — `bilinearQuad`, `projectiveQuad`, `bicubicMesh`, `coonsMesh`, and `rigidPuppetMap` — and `warpPath(path, map, { tolerance })`, which carries any path through any point map and refits each segment as cubics within the tolerance, keeping every anchor. `PathWarp` describes a warp as data, with `applyPathWarp`, `warpControls` and `moveWarpControl` over it.
