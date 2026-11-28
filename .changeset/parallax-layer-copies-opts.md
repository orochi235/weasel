---
'@weasel-js/parallax': patch
---

`createParallaxLayer` copies plain `parallax` opts when built, so editing the object passed in no longer moves the plane.

<!-- entry: fix -->
