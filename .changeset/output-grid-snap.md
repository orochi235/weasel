---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/routing': patch
'@weasel-js/diagram': patch
---

Keep a scene's marks on an output target's dot grid. The document holds the grid as `kit:outputGrid` (`OUTPUT_GRID_KEY`), so setting it is an undoable edit. A scene's new `quantize` option takes a `QuantizeRule`: its `stored` half answers the pose or data the document holds on the grid, and runs on every committed write, on every node when the grid changes (in the same undo entry), on a document as it is built or loaded, and on resize, move and insert previews; its `drawn` half answers where the scene walk draws a node, while picking keeps the stored pose. core adds `quantizeSize` and `outputGridOf`; geom adds `snapToPitch` (whole dots, never below one) and `alignToGrid`. The `insert` dep gains `peek`, the node `build` would insert with no id minted and the palette not advanced, which core's insert dep and diagram's stencil insert implement; an `insertPreview` overlay's new `lands` fits the preview to where the quantize rule lands the shape.
