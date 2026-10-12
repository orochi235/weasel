# @weasel-js/animator

Tweens, springs, holds, staggers, and timelines on one frame loop, with no scene underneath.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/api/).

```sh
npm install @weasel-js/animator
```

```tsx
import { createTarget, useAnimator } from '@weasel-js/animator';

const animator = useAnimator();
let x = 0;
const target = createTarget({ get: () => x, set: (v) => { x = v; }, show: draw });

animator.tween({ target, to: 100, ms: 300 });
animator.spring({ target, to: 40 }); // bends the motion; neither cancels the other
```

| Export | What it is |
|---|---|
| `useAnimator()` | The animator: `tween`, `spring`, `physics`, `decay`, `hold`, `loop`, `stagger`, `timeline`, and `watch`. The frame loop stops while its host is unseen. |
| `createTarget(opts)` | One value an animator moves. Animations on a target add, so a second one bends the first. |
| `createTargetTable(opts)` | Many like values as rows of flat arrays, shown in one pass. |
| `sampleTrack`, the `Track` types | Keyframe tracks for `animator.timeline`. |
| `resolveSkeleton`, `skeletonAxes`, `solveIk`, `mirrorPose` | Skeleton math: joints to matrices, a skeleton pose as a target's axes, two-bone IK. |
| `tweenVertexColors` and its siblings, `ColorOverrideRegistry` | Per-vertex color animation, and the table a renderer reads the colors from. |
| `createSlew`, `slewToward` | A value that follows another at a bounded rate. |

Moving a scene node's pose is `@weasel-js/core`'s half: `tweenPose`, `springPose`,
`momentum`, `bindRig`, and `useAnimatedReflow` drive this animator against a scene. How
animations combine on a target is in
[concepts](https://github.com/orochi235/weasel/blob/main/docs/concepts.md) under
"Animation target".
