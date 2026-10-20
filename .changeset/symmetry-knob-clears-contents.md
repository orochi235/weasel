---
'@weasel-js/symmetry': patch
---

The symmetry guide's angle knob no longer sits on the shapes it turns. It stays `knobDistancePx` out while the group's contents are nearer than that, and otherwise moves out past the farthest of them, clear by twice the hit radius. `SymmetryGuideSource.current()` may return `reach`, the world distance from the center to the farthest point of the contents (`createSymmetry` fills it in), and `guideHandles` takes it and the clearance as optional trailing arguments.
