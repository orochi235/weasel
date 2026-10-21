---
"@weasel-js/core": patch
"@weasel-js/path-tools": patch
---

Set, swap, or release the spine of a blend that already exists. `setBlendSpineAction`
(`setBlendSpine`) lays the selected blend along the other selected path, in either selection order,
replacing any spine it had; `releaseBlendSpineAction` (`releaseBlendSpine`) puts each selected
blend back on a straight run between its two shapes and selects the spines, ordinary paths where
they were. Both are in `pathEffectsPreset` and the `pathEffects` group, and each is one undo step.

Core adds `createSetDependsOnOp`, an undoable retarget of a derived node's `dependsOn`, and the
`setDependsOn` write it goes through on `SceneMutators` and the scene-backed adapter.
