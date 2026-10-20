---
"@weasel-js/guides": patch
---

`alignmentSnapSource`, `spacingSnapSource` and `createSpacingHintsPreset` take a `filter` that decides which nodes offer lines or gaps; a node it rejects is never a snap target. Its type is exported as `TargetFilter`. It narrows the default siblings and does not apply to `getCandidates` or `getTargets`.
