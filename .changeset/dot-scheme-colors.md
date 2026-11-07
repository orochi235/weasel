---
'@weasel-js/diagram-formats': patch
---

Reading DOT, a color from a palette scheme such as Brewer's (`/blues9/3`) is dropped with a warning. The reader used to strip the scheme and keep the bare index, so such a node read back with a color of `3`, which nothing can draw. X11 and SVG scheme colors (`/x11/red`, `/svg/navy`) are read as their names, as before. `dotColor` now returns `undefined` for a color it cannot read.
