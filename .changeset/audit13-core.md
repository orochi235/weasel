---
'@weasel-js/core': patch
'@weasel-js/select': patch
'@weasel-js/react': patch
---

Fixes to the canvas's Shift-click range, how selections hold their ids, per-anchor stroke data through the path commands, and `useNearViewport` in a second window.

- A Shift-click range on `<SceneCanvas>` leaves out what a click there could not select: a node on a locked or hidden layer, and one `isPointerInteractive` rejects. The `selectRange` dep ranges the same way. Before, the range walked the adapter and took them all.
- The scene's selection and `createSelectionStore` hold an id they are given twice once, so a selection of one node never counts as two. A write that leaves the selection as it was tells no subscriber and keeps the array readers hold, so `useSelection` no longer re-renders on it.
- `useNearViewport` observes the viewport of the document its element is in, listening for that document's scrolls and its window's resizes, so an element in a popout window is measured against that window rather than the main one.
- Cut at Crossings cuts a stroke's per-anchor widths and colors to each piece, blending them where a cut falls between two anchors, so a piece of a tapered stroke keeps its own part of the taper. Offset Path, Simplify and a warp drop per-anchor widths and colors (the stroke's and the fill's) whose length no longer matches the path's anchors, where they used to keep the whole path's arrays.
