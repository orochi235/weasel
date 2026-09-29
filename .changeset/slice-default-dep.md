---
"@weasel-js/core": patch
---

`<SceneCanvas>` now publishes a default `slice` dep, so `useSliceTool` cuts with nothing else wired. Each cut swaps every path it crosses for its pieces in one undo step: an open path is snipped, a closed one is knifed, and a closed loop cuts the region it encloses out as its own piece. The pieces of a selected shape stay selected. Paths are cut where they are drawn and the pieces are stored in their parent's frame under `poseComposition`. Nodes on locked layers and nodes with derived geometry are skipped. Additive: `useSliceDepSource` and the pure `computeSliceOps` are new exports, and a consumer's own `useSliceDep` still replaces the default. The WeaselDraw copy is gone.
