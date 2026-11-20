---
'@weasel-js/core': minor
'@weasel-js/editing': minor
---

Two same-size nodes can trade places: hold one still over the other while dragging it, or select both and run the `swap` command.

Turn the drop on with the move's `swapOnDrop: 'dwell'` param (`<SceneCanvas tune={{ move: { params: { swapOnDrop: 'dwell' } } }}>`). Resting a single dragged node over another for a second arms the swap: the other slides into the dragged one's starting place, is outlined, and the cursor shows the swap glyph. Released there, the two trade places, parents and stacking order as one undo step, "Swap". A binding that wants another wait or its own target passes `swapOnDrop({ dwellMs, targetAt })` from `@weasel-js/editing` in its `behaviors`.

The `swap` action (in the `arrange` preset, and `presets.swap`) does the same for exactly two selected nodes. Which nodes may swap is the new `canSwap` dep's to say; without one, two nodes of one `kind` and one size do. `swappable` asks that rule, and `swapOps` builds the commit both use.

<!-- entry: rank=10 new api -->
