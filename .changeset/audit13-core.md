---
'@weasel-js/core': patch
'@weasel-js/select': patch
'@weasel-js/react': patch
---

Fixes to the canvas's Shift-click range, how selections hold their ids, and `useNearViewport` in a second window.

- A Shift-click range on `<SceneCanvas>` leaves out what a click there could not select: a node on a locked or hidden layer, and one `isPointerInteractive` rejects. The `selectRange` dep ranges the same way. Before, the range walked the adapter and took them all.
- The scene's selection and `createSelectionStore` hold an id they are given twice once, so a selection of one node never counts as two. A write that leaves the selection as it was tells no subscriber and keeps the array readers hold, so `useSelection` no longer re-renders on it.
- `useNearViewport` observes the viewport of the document its element is in, listening for that document's scrolls and its window's resizes, so an element in a popout window is measured against that window rather than the main one.
