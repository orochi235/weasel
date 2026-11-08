---
'@weasel-js/core': patch
---

Fixes from an audit of core's path edit, path effects and snapping:

- A drawn line's or a measurement's start that snapped to an anchor shows the anchor's mark until the end moves; it was dropped at once.
- `createSnapSession2d` puts a move's `geometry` probe on the subject's outline nearest the press, as a canvas's `snap` dep does; it sat at the press. It also throws when two sources share an id, as the canvas does.
- Path edit's anchor overlay takes a previewed pose and previewed data each from the first in-flight handle that gives one, as the drawn preview does. It kept the last handle's data, and a handle previewing only data hid a later handle's pose.
- A snap session hands sources one `exclude` array for the whole gesture, so `rotationSnapSource` reads other nodes' angles once per gesture again when the subject has no ids.
