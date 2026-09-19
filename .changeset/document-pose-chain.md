---
'@weasel-js/core': patch
---

`documentPose` now ignores pose overrides along a derived node's whole dependency chain, not just on the node itself. Before, a derived node's document pose moved while something it derives from was being dragged, which let the minimap's framing follow a drag in any scene with derived poses. `effectivePose` is unchanged. Behavior change, no API change.
