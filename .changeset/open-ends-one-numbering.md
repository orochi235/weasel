---
'@weasel-js/geom': patch
---

`openPathEnds`, `openEndRay`, `extendToMeet` and `lengthenOpenEnd` now number an
`OpenPathEnd`'s subpath the way the path's anchor set does, a bare `M` included,
as `lengthenPathEnd` and `openEndAt` already did. On a path holding an empty
subpath, Extend to next path used to extend a different end from the one picked.
