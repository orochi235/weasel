---
'@weasel-js/core': patch
---

Breaking: a scene's pose composition is the scene's own. Pass it once, as `useScene({ composition: RIGID_POSE_COMPOSITION })` (or `createScene`, `sceneFromJSON`), and read it as `scene.composition`; a scene given none answers `IDENTITY_POSE_COMPOSITION`. The canvas, the adapter, the layout pass, picking, the headless renders, and every built-in action read it from the scene.

Removed, each replaced by the scene option: the `<SceneCanvas poseComposition>` prop; `sceneToAdapter`'s `poseComposition` and `cascadeContainerPose` options; `LayoutFrame.composition`; the `poseComposition` option of `scenePickSource` and `useLayoutArrivals` / `layoutArrivalHandler`; the `poseComposition` routing dep and `usePoseCompositionDepSource`; and the composition parameter of `buildSceneViewCommands`.

Changes behavior: `sceneToAdapter(scene)` on an absolute-pose scene now always carries a container's descendants when the container is posed, where it did so only under `cascadeContainerPose: true`. `renderSceneToPixels`, `renderSceneToCanvas`, and `<SceneViewCanvas>` now compose poses for a scene that has a composition, where they painted every node at its stored pose.

Adds API: `composesFrames(composition)`, whether a composition makes a container's pose a frame.
