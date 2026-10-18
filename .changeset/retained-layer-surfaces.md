---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

An unchanged layer of a few hundred commands or more is now drawn once into a texture of its own and composited as one quad on later frames, instead of being submitted again every frame.

`GroupDrawCommand.retain` names the surface. The renderer keeps the group's pixels while its `children` array and everything it was drawn under hold: the enclosing transform, alpha and color matrix, the view matrix, the drawing size and dpr, and the fonts, textures, paint kinds and programs it serves. Anything else draws it again. A surface is drawn in a multisampled buffer matching the canvas's own, so its edges come out as they would have on the canvas, and it is freed at the end of the first frame that does not draw its id. `WeaselRendererOptions.retainBudget` caps the memory retained surfaces hold together (default `DEFAULT_RETAIN_BUDGET`, 256 MiB, scratch buffer included); a group past it draws straight through. `RenderStats.retained` reports how many groups were composited, redrawn, or declined, and the bytes held.

`drawLayers` marks a layer for retaining once its `deps` have held for a frame and, for a world-space layer, the view has too, if it holds at least `DEFAULT_LAYER_RETAIN.minCommands` (250) drawing commands. `RenderLayer.retain: false` opts a layer out and `true` retains it whatever its size. A layer with `effects` is not retained. The new trailing `drawLayers` argument takes another `LayerRetainPolicy`, or `false` to retain nothing.
