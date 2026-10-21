---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

A move, resize or rotate keeps its in-flight poses in one place: the scene's pose overrides.
Their handles no longer answer `previewPose`; `previewIds` still names the nodes in flight, and
`previewData` still carries what a transform follower previews. The preview ghost
(`resolvePreviews`) and the selection chrome resolve a previewed id with no `previewPose` through
`effectivePose`, so they read the same pose picking and derived geometry already did. Code that
read `previewPose` off one of these handles reads `effectivePose(scene, node)` instead. A
transform follower that previews a node at a pose other than its own now publishes that pose to
the overrides too; one answering the node's own pose pins nothing, so a derived node keeps
deriving.
