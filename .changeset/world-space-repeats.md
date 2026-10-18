---
'@weasel-js/core': patch
---

Nudge, Duplicate, Move by, and Transform Again offset a node in world space,
mapped through the frame its parent defines, the way a drag and an Alt-drag
clone already did. Inside a turned group, an arrow key now moves the selection
along the screen rather than along the group's axes, and Cmd+D after a drag
steps the way the drag went. `translateSelection` and `duplicateSelection`
take a world offset.
