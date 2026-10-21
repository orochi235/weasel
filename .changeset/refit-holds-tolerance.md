---
"@weasel-js/geom": patch
---

`simplifyPath` and `warpPath` hold their refitted curves within the tolerance everywhere, not
only at the points they sample from the original. A refit used to check only that those samples
lay near the fitted cubic, and a straight segment is sampled at most eight times, so a cubic
fitted across a turn and the start of a long flat could bulge between samples: 0.29 off at
tolerance 0.1 on a rounded corner `offsetPath` grows. Each fitted cubic is now also checked
against the run it replaces, and split where it strays.
