---
'@weasel-js/geom': patch
---

`schneiderFit` measured a fit's error at evenly spaced curve parameters instead of the ones it had fitted each sample at, so samples spaced unevenly along a stroke (a fast move, then a slow one) read as badly fit and the curve was split far more than its tolerance asked for, down to one cubic per pair of samples. Four collinear samples at x = 0, 1, 2, and 100 now come back as the single cubic they are.
