---
'@weasel-js/ui': patch
---

`PaintInput` takes a `subject` prop naming what it is pointed at (a selection key, a node id). Its memory of the paint last seen for each kind is dropped when the subject changes, so a control left mounted across a selection change no longer offers the new selection the last one's gradient. A caller that gave it a `key` for this passes `subject` instead.
