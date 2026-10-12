---
'@weasel-js/core': patch
---

`InsertPaint` may name a fill rule. This adds API: the object an `insertPaint` callback returns takes an optional `fillRule`, and a pencil trail, a pen path, a polygon, or a star inserted through it is built with that rule where it was always nonzero. A rect or an ellipse carries no rule and is unchanged, and a callback that names none behaves as before. Added on an agent's judgment, so WeaselDraw's "Path fill rule" preference has something to set.
