# @weasel-js/animator

Tweens, springs, holds, staggers, and timelines on one frame loop, with no scene underneath.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/animator).

```sh
npm install @weasel-js/animator
```

```tsx
import { createTarget } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';

const animator = useAnimator();
let x = 0;
const target = createTarget({ get: () => x, set: (v) => { x = v; }, show: draw });

animator.tween({ target, to: 100, ms: 300 });
animator.spring({ target, to: 40 }); // bends the motion; neither cancels the other
```

| Export | What it is |
|---|---|
| `useAnimator()` | The animator: `tween`, `spring`, `physics`, `decay`, `hold`, `loop`, `stagger`, `timeline`, `watch`, and `live`, with `pause`, `resume`, and `setTimeScale` over everything it runs. The frame loop stops while its host is unseen. |
| `createTarget(opts)` | One value an animator moves. Animations on a target add, so a second one bends the first. `target.axisIndexes(['y'])` answers where the axes it names sit among the target's numbers. |
| `createTargetTable(opts)` | Many like values as rows of flat arrays, shown in one pass. |
| `sampleTrack`, the `Track` types | Keyframe tracks for `animator.timeline`. |
| `resolveSkeleton`, `skeletonAxes`, `solveIk`, `mirrorPose` | Skeleton math: joints to matrices, a skeleton pose as a target's axes, two-bone IK. |
| `tweenVertexColors` and its siblings, `ColorOverrideRegistry` | Per-vertex color animation, and the table a renderer reads the colors from. |
| `createSlew`, `slewToward` | A value that follows another at a bounded rate. |

A hold or a timeline track over part of a target names the axes it holds, by the value's own
fields or by index. A rig's pose target names its axes `<joint>.<field>`, so a joint's name
reaches all five of its axes:

```tsx
animator.hold({ target, value: { x: 0, y: 120 }, axes: ['y'] });
animator.hold({ target: rig.target, value: pose, axes: ['armL', 'foreL.rotation'] });
```

`animator.stagger(items, delay)` answers a builder. Its `.tween` and `.spring` move the items
themselves where they are targets, a `target` named per item otherwise, and hand values to
`onTick` with neither; `.each` runs any factory.

```tsx
animator.stagger(targets, 80).spring({ to: (target) => ({ ...target.committed(), y: 200 }), preset: 'wobbly' });
animator.stagger(rows, 80).tween({ target: (row) => row.target, to: 1, ms: 300 });
```

Moving a scene node's pose is `@weasel-js/core`'s half: `tweenPose`, `springPose`,
`momentum`, `bindRig`, and `useAnimatedReflow` drive this animator against a scene. How
animations combine on a target is in
[concepts](https://github.com/orochi235/weasel/blob/main/docs/concepts.md) under
"Animation target".
