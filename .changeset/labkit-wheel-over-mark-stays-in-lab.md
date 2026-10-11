---
'@weasel-js/labkit': patch
---

A wheel or trackpad pinch over an annotation mark's box zoomed the trial's camera and was also left for the browser, which could scroll or zoom the page at the same time. The event handed to the camera is now canceled on the original when the camera takes it.
