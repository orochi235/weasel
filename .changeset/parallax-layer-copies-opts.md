---
'@weasel-js/parallax': patch
---

`createParallaxLayer` copies plain `parallax` opts when built, so a later edit to the object passed in no longer moves the plane at the next unrelated repaint.

<!-- entry: fix -->
