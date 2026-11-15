---
'@weasel-js/core': minor
---

The interfaces `Scene`, its nodes and its layers are built from are now exported, so a consumer can name, extend or pick from them.

`SceneChanges`, `SceneEditPasses`, `SceneHistoryPersistence`, `SceneReplay`, `SceneLayerMembers` and `SceneSelectionMembers` are the parts `Scene` extends; `SceneNodeBase` is what `MarkNode` and `GroupNode` share, and `LayerRecordBase` what `SystemLayerRecord` and `UserLayerRecord` share. `ShownOverride`, the part of a pose override `PoseHold` reads, is exported beside them.

New `AnyScene`, `Scene<unknown, string, unknown>`: the type a function takes when it reads a scene without inspecting its payload, layers or pose. Core's own such signatures (`moveNodesOps`, `booleanGroupOps`, `scrollableAt`, `insertSite`, `createEnteredGroup` and others) now name it.

<!-- entry: api -->
