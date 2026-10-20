# @weasel-js/rig

The rigging tools for a weasel canvas: the bone tool, which draws and edits the
skeleton a node holds, and the weight tool, which paints how much each joint
moves the paths under that node.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/rig).

```sh
npm install @weasel-js/rig
```

A rig lives in the scene. A node holds the skeleton in `data.skeleton`, its
joints relative to that node's box, and the paths under it hold their weights
in `data.skin`. Core's `useRigNode` binds a rig from that data, and this
package's tools edit it, one scene op per edit, so undo, save and paste treat a
rig like any other node data.

```tsx
import { SceneCanvas, useRigNode } from '@weasel-js/core';
import { createRigEditState, useRigTools } from '@weasel-js/rig';

const state = useMemo(() => createRigEditState(), []);
const tools = useRigTools({ scene, state });
useRigNode({ scene, node: arm, painting: state });

<SceneCanvas scene={scene} features={['pick', 'paths']} tools={tools} />;
```

`useRigTools` builds every tool in `RIG_TOOLS`, keyed by id:

| Tool | Key | What it does |
|---|---|---|
| `bone` | <kbd>J</kbd> | A drag on a joint moves it with the joints under it; a drag from anywhere else draws a bone from the active joint, or from the press if none is active. A click picks the active joint, and <kbd>Delete</kbd> removes it with everything under it, taking its weights out of every skin beneath the rig |
| `weight` | <kbd>W</kbd> | A round brush: the points under it follow the active joint more, the nearer the brush's center, and with <kbd>Alt</kbd> less. Every point shows as a dot colored by the active joint's share of it |

Both tools act on the rig the selection names: with one node selected, the
nearest of it and its ancestors that holds a skeleton, else that node itself,
so a first bone can be drawn onto it. `rig` fixes one instead. The two share a
`RigEditState`, so a joint picked in one is the active joint in the other; give
the same state to `useRigNode` as `painting` and a weight stroke bends the path
as it is painted. `useBoneTool` and `useWeightTool` build either tool alone.

The tools' dot sizes are the kit settings `targets.boneJointRadiusPx` and
`targets.weightPointRadiusPx`, which `rigKitSettingsSchema` lists for a
settings page.
