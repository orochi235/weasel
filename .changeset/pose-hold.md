---
'@weasel-js/core': patch
---

core: `scene.overrides.hold()` hands out a `PoseHold`, a writer's claim on some nodes' pose overrides. `hold.set(poses)` publishes a whole frame with one notification and releases any id the frame leaves out, `hold.others()` answers the poses other writers are publishing, and `hold.drop()` releases what the hold still owns, leaving alone an entry another writer has since replaced. Move, rotate, resize, and `usePoseRun` publish their previews through it. `PoseHold` is exported, and `PoseOverrides` gains the `hold` method, so a hand-written `PoseOverrides` has to supply one; `createPoseOverrides` builds a complete table.
