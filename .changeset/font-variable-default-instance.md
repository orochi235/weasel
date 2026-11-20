---
'@weasel-js/font': patch
---

A local variable font's named instances other than its default keep their text on the SDF tier instead of drawing the default's outlines.

`enableLocalFontOutlines` registers each instance, and the outline parser can draw only the default.

<!-- entry: fix behavior -->
