---
'@weasel-js/core': patch
---

Under a composing `poseComposition`, a container whose pose derives from its children (`dependsOn: 'children'` with a `derivePose`, as `groupAction` mints under the default strategy) is now an envelope rather than a frame: its children are stored in the same frame it is, and the render walk, `getWorldPose`, picking and the actions' world/local conversions pass over it. Before, its derived pose was folded in as the children's frame, which moved every child by its own offset. `unionOfChildren` needs no change and is right under any strategy. `definesFrame(node)` is exported, and `PoseAdapter` takes an optional `definesFrame(id)` so a hand-built adapter can say the same to `composeWorldPose` and `rebaseLocalPose`. Nothing changes without a composing strategy.
