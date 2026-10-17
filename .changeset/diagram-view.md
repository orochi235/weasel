---
'@weasel-js/diagram': patch
---

A custom `Path` outline is drawn in a unit square and stretched over its node's box, as a mark's path data is, so it follows its node when layout or a drag moves it. Breaking: a `Path` outline built in world coordinates now has to be rebuilt in the unit square.
