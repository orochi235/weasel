---
'@weasel-js/labkit': patch
---

`createLensApi` listens to its scene only while a Follow lens is held, so an api a host drops no longer keeps a listener on the scene.

<!-- entry: fix -->
