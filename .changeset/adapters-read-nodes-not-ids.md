---
'@weasel-js/core': patch
---

Take the id→node lookup off the render and hit-test paths.

Six call sites walked `scene.renderOrder()` and immediately resolved each id
back through `scene.get` — a map lookup per node, per call, for nodes the
traversal had already held. They now read `scene.renderOrderNodes()` directly:
`sceneToAdapter.getNodes`, the move gesture adapter and the default commit
adapter, `useSceneSelectTool`'s `hitTestArea` and default `pickEvery`, and the
text-edit hit test. Adapter `getNodes` runs on the render path once a frame.

Building the node list is about twice as fast (`npm run bench`, `min`, Apple M2
Max / Node v26.1.0):

| nodes | via `renderOrder` + `get` | via `renderOrderNodes` |
|---|---|---|
| 1,000 | 0.031 ms | 0.011 ms |
| 10,000 | 0.40 ms | 0.19 ms |

`tests/bench/scene-ops.bench.ts` gains that comparison, and the committed
baseline is re-recorded.
