---
'@weasel-js/core': patch
---

Under a composing `poseComposition`, a container whose pose derives from its children (`dependsOn: 'children'` with a `derivePose`, as `groupAction` mints under the default strategy) is now an envelope rather than a frame: its children are stored in the same frame it is, and the render walk, `getWorldPose`, picking and the actions' world/local conversions pass over it. Before, its derived pose was folded in as the children's frame, which moved every child by its own offset. `unionOfChildren` needs no change and is right under any strategy. `definesFrame(node)` is exported, and `PoseAdapter` takes an optional `definesFrame(id)` so a hand-built adapter can say the same to `composeWorldPose` and `rebaseLocalPose`. Nothing changes without a composing strategy.

`moveAction`'s translate-only drag and commit are now right under a composing strategy. Dragging a frame container no longer also translates its descendants, which moved them twice; they ride the frame. A node stored under a turned frame now moves the way the pointer went, instead of by the world drag applied in its frame's rotated axes.

Copy and paste now keep a container's `dependsOn: 'children'` and `derivePose`, so a pasted group still tracks its members, under any strategy. Under a composing strategy, `snapshotSelection` also captures in world coordinates any node whose frame is not part of the copy, and `commitPaste` no longer offsets nodes inside a pasted frame a second time.
