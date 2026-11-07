---
'@weasel-js/renderer': patch
---

A vector source whose re-raster at a larger size fails now fires `subscribeImageReady`, as a failed load does. A reader waiting for the sharper raster heard nothing before, and waited on whatever image landed next.
