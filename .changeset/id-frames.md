---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

Id frames, for picking and coverage masks. `WeaselRenderer.renderIds` draws a command list again into a buffer of its own, holding a second color attachment beside the color, and reads back which `GroupDrawCommand.pickId` each device pixel carries, culled to a `rect` when one is given. Every program writes the id output, a consumer's custom shaders and effects included, with no change to their source: the renderer adds it at compile time. A pixel takes the id of the last fragment to paint it at `minAlpha` or more, so a custom shader claims what it paints rather than its bounds, and a group's effects claim what they spread into. `idMask` turns an id buffer into a one-byte-per-pixel mask of chosen ids, the shape `ditherPixels`'s `protect` and `protectTexture` take.

In core, every scene node's paint carries a `pickId` from `scenePickIds(scene)`, which names the node back; a canvas handle's `pickAt(x, y)` reads the id under a point of its last frame; and `RasterSession.renderIds` returns a headless render's ids. The dithering demo's "By mask" protects every dot a mark paints, plus its quiet zone, instead of rects alone.
