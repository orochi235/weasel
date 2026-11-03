---
'@weasel-js/core': patch
---

A move that drops a group whose box is its children (an envelope) now lands those children where the drag
showed them. Dropped into another group or onto another page, they used to keep their old coordinates in
the new container's frame, and land off by the distance between the two. Kept on its page with the
pasteboard off, an envelope's selected child now moves with the envelope's shift instead of by the drag
alone.

A reparent-on-drop of a group selected with one of its own children keeps that child in the group, where it
used to be pulled out into the drop target beside it.
