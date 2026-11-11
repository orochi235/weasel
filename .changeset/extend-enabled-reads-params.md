---
"@weasel-js/path-tools": patch
---

Extend to next path, handed params, is enabled exactly when the run those params make would carry an end on. It used to ask only whether the default ease or a straight run would, so with a tighter `easeTurn` it could be enabled and do nothing. Handed no params, it still enables when either shape meets a stroke, since the last-operation panel can switch shapes.
