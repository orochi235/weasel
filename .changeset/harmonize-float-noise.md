---
"@weasel-js/geom": patch
---

`harmonizeAnchors` no longer reports a change for a path that is already curvature-continuous. Stored in single
precision, such a path re-solved about 1e-4 away from itself, past the old 1e-6 threshold, so Harmonize curvature
stayed enabled and each run pushed an undo step that moved nothing visibly.
