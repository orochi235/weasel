---
'@weasel-js/core': patch
---

A container's pose can now define a **frame**: a child's stored pose is
expressed in it, so rotating a container rotates its contents and moving one
carries them without touching their poses. Opt in with
`<SceneCanvas poseComposition={RIGID_POSE_COMPOSITION}>` or
`sceneToAdapter(scene, { poseComposition })`. Omit it and nothing changes —
poses stay absolute, exactly as before.

Before this, nesting contributed a clip chain and nothing else. `getPose` was
documented as returning a local pose while every render walk, both pick
sources, all selection chrome and the clipboard treated it as world, which
agreed only because no consumer ever supplied a composition.

`getPose` still returns the stored pose. `getWorldPose` on the scene adapter is
the composed reading, and is what picking, chrome, `getNodeAtPoint` and the
clipboard consume. `composeRigidPose` / `decomposeRigidPose` and the
`RECT_POSE_COMPOSITION` / `RIGID_POSE_COMPOSITION` strategies are exported.

`PoseComposition` gains a required `closure` field naming the transforms it
represents exactly. This is a breaking change to that interface for anyone
constructing one by hand; nothing in the repo did. `RectPose` carries no scale
factor, so the strategy that ships is rigid — translate and rotate — and an
anisotropically scaled parent is outside what a pose can hold, since it turns a
rotated child into a parallelogram.

`sceneToAdapter` throws when given both `poseComposition` and
`cascadeContainerPose`. The cascade translates every descendant when a
container moves, which is what absolute poses need and would move a framed
child twice.

`useNodeOverlayFrame` read the authored pose, so an overlay ignored gesture
overrides and derived poses. It reads the effective pose now.

Design: `docs/superpowers/specs/2026-09-10-group-as-frame-design.md`.
