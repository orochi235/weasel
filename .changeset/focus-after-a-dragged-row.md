---
'@weasel-js/ui': patch
---

`PrefsForm` could ignore keyboard focus moving into a row: after a press on that row became a drag, with no click to end it, `onSelect` was not called when the reader later tabbed into the row. The form now forgets the press when its pointer comes up or is canceled.
