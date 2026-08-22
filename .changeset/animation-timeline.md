---
'@weasel-js/core': patch
---

Add a keyframe timeline primitive and a hierarchical rig.

This adds public API surface.

`animator.timeline(opts)` registers like any other animation, so its playhead
responds to `pause`, `setTimeScale` and `cancelKey`. Sampled tracks are a pure
function of the playhead and reuse the tween interpolation contract; event
tracks fire only on forward playback and stay silent under `seek`; timeline
tracks nest, evaluated at the parent's playhead minus their offset.

The rig ships as `blendPoses` and `resolveSkeleton` over a `Skeleton` of joints
carrying their own TRS — not the scene's consumer-defined `TPose`, which may be
a bare AABB with no rotation term a joint chain can compose through. A pose is
local deltas from bind, so an absent joint or field means "no change".
Animating a rig is a `SampledTrack<Pose>` whose `interpolate` is `blendPoses` —
no rig-specific timeline machinery.
