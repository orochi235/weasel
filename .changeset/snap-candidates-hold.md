---
"@weasel-js/core": patch
"@weasel-js/kernel3d": patch
---

A snap candidate can say with `holds` whether it still holds at the resolved move, and a session resolves again without one that does not.

`holds?: (delta) => boolean` is optional; a candidate without it always holds. The 2D and 3D sessions ask it already. A host building its own session calls the new `resolveHolding(candidates, resolve, toPoint)`, which runs `resolve` again without members that do not hold; `GatheredCandidate` is the candidate type it takes.

<!-- entry: api -->
