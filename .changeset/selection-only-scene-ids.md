---
"@weasel-js/core": patch
---

The scene's selection holds only ids that are in the scene. `setSelection` drops an id that names no node, so an action that selects a node its own batch removed (an ungroup whose container takes a dependent child with it) no longer leaves a dangling id selected.
