---
'@weasel-js/geom': patch
---

The path hit tests (`pointInPath`, `pathIntersectsRect`, `polygonIntersectsPath` and the rest) flatten a path once for each tolerance and reuse that outline, instead of flattening it again on every call. Testing many points against one path is much faster: a test of about 11,000 grid points against two curved outlines at a 1e-4 tolerance went from 3.6 s to 64 ms. As with the length tables, the cache is keyed on the path object, so a path must not be changed in place once it has been hit-tested.
