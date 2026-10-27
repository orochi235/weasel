---
'@weasel-js/core': patch
---

A container's content can be scrolled. `scene.scroll` holds one offset per container (`scene.scroll.set(id, { x, y })`); like the selection it is view state, never recorded, serialized or counted in the scene's version. The document never moves: painting, picking, selection chrome, the preview ghost, an insert's landing and every gesture show a scrolled container's children moved by minus its offset, and write back through the same fold, so a move inside a scrolled container stores the content position. The layout pass and other document writers fold through the unscrolled frame. This adds API.

`PoseComposition` gains an optional `scroll(frame, offset)`; `RECT_POSE_COMPOSITION` and `RIGID_POSE_COMPOSITION` supply it (`scrollRectPose`, `scrollRigidPose`, along a turned container's own axes), and a composition without it cannot scroll. `PoseAdapter` gains an optional `childFrame(id, world)`, which `composeWorldPose` and `rebaseLocalPose` honor; `scrolledFrames`, `viewPoseAdapter` and `sceneViewPoseAdapter` build it from a scene, and `composeChildFrame` and `childFrameAt` read the frame a container gives its children. During a move, a layout strategy is handed its container's content frame as `LayoutContainer.bounds`, so its slots agree with the children as shown.
