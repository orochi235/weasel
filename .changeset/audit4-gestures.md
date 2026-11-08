---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
---

Fixes from a second audit of gesture recognition and input routing:

- A three-finger tap whose fingers lift in the order they landed is a `multiTouchTap` again; it was rejected because the centroid of the last two fingers was compared with that of the first two. A tap also reports its peak finger count when fingers lift and land again during it.
- A long-press or a canceled press between two clicks ends the double-click sequence, as a drag already did, so the next click is not a double click.
- A wheel counted in pages scales its horizontal delta by the canvas width, not its height.
- A held key that went down with Cmd is released when Cmd comes up: macOS sends no keyup for a key released while Cmd is down, so a `key-held` binding on Cmd+key stayed engaged.
