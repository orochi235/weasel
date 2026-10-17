---
'@weasel-js/geom': patch
---

`tessellate` fills a nonzero path whose outlines cross. A self-crossing outline used to go straight to earcut, which assumes it does not cross, so a figure eight lost the lobe wound the other way; outlines crossing each other lost regions or covered the overlap twice, which doubled a translucent fill. Such a path is now cut at its crossings and rebuilt as the boundary of what it fills before triangulating. Paths whose outlines do not cross triangulate as before.
