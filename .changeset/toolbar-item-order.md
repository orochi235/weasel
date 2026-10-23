---
"@weasel-js/prefs": patch
"@weasel-js/ui": patch
---

`Bar` takes `order`, a `PrefOrder` that sets the order of its items and groups, and `onReorder`, called with the new order when the user moves one. Passing `onReorder` turns reordering on: hold Cmd and drag an item to move it within its group, or Cmd+Shift and drag a group to move it among the others; with the keyboard, Alt+arrows move the focused item and Alt+Shift+arrows move its group. A plain press still clicks, nothing crosses a group boundary, Escape cancels a drag, and the new position is announced. The same works along a straight or a curved bar. The kit stores nothing: a host keeps the order itself, as a user pref.
