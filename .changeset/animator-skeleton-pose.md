---
'@weasel-js/animator': major
---

The animator's `Pose` type is `SkeletonPose`, since it holds joint deltas and is not a scene node's pose.

```ts
// before
const track: SampledTrack<Pose> = { … };
// after
const track: SampledTrack<SkeletonPose> = { … };
```

<!-- entry: breaking api -->
