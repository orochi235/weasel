---
'@weasel-js/ui': patch
---

Three keyboard fixes in `LayerList`. ArrowLeft on a row under a card no longer jumps focus to the first row in the list. Removing a row from its own remove button moves focus to the row that takes its place, where it used to fall to the page. A card with a `badge` in a list without `onReorder` shows the badge as plain decoration, where it used to be a focusable "Drag to reorder" button that did nothing.
