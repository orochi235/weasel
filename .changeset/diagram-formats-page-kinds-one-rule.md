---
'@weasel-js/diagram-formats': patch
---

`scenePageKinds` and `documentFromScene` agree on which pages are plot or sequence pages.

Only outermost content makes a page a plot or sequence page, and a page holding both is a plot page. A plot or sequence root inside a group or container no longer turns its page into one on export.

<!-- entry: fix data -->
