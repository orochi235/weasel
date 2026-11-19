---
'@weasel-js/labkit': patch
---

`useUndoKeys` leaves Mod+Z to an open menu or a modal dialog

It now binds the undo and redo chords through `usePageActions` instead of a document listener, so the dispatcher's filters apply: a chord typed in an open menu, or in a modal dialog over the page, stays with it.

<!-- entry: behavior -->
