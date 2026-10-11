---
'@weasel-js/ui': patch
---

In `PrefSchemaEditor`'s structure tree, a range taken upward with shift-click now leads with the row that was clicked, as a range taken downward does. Before, the row just above the range's start led, so the attributes pane and the preview followed the wrong node.
