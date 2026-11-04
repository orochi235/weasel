---
'@weasel-js/core': patch
---

A locked page, or any locked container, no longer takes drops, inserts or pastes. A drag, a tool press or a paste over a locked page goes to the nearest page that takes it, where before the commit threw.

Paste now asks the `canDropInto` dep, as insert does: a paste over a page the dep refuses goes to the nearest page it admits, and a container `insertInto` names is passed over when the dep refuses it.

Dragging a node from one page into a group on another page on a higher layer moves it onto the group's layer, where before the commit threw.

A node following others, such as a connector, moves to the page what it follows lands on, or into the page run when that spans pages, after reparent-on-drop, a layout drop or release, Group, and Make Boolean Group, not only after a drop onto a page or a paste. One inside a group on a page moves too.

Renaming, moving, resizing or removing a page in a scene with no pages leaves the scene alone, where before it made the scene paged with no pages.
