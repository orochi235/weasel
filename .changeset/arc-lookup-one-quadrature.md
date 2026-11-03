---
'@weasel-js/geom': patch
---

A point at a length along a curve is about five times faster: `measurePath(...).at()` on a path of four cubics went from 0.40 to 0.077 µs and `pointAtLength` from 0.40 to 0.093 µs (M3 Max, median of 8 runs each), and a 1,000-vertex `bendAlongPath` on a curved spine from 3.3 to 1.8 ms. Answers are still the exact point on the curve, solved to the same tolerance as before. Each curved segment's length table now also keeps the speed at each step and how precisely each step can be measured, so a query usually costs one four-point measurement and one Newton step.
