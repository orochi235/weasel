---
'@weasel-js/core': patch
---

Animated vertex colors now reach nodes the scene paints itself. `<SceneCanvas animator>` paints `animator.colorOverrides` — what `tweenVertexColors`, `springVertexColors`, `cycleVertexColors` and `staggerVertexColors` write — onto the scene's nodes: the built-in path, shape and derived-path painters apply them, and a custom `drawOne` receives them as the new `NodePaintCtx.vertexColors`. Before, only `createPathLayer` read the registry, so a default-painted node ignored every color animation.

The same colors reach detached renders: `<SceneViewCanvas>` takes an `animator` prop, and `renderSceneToCanvas`, `renderSceneToPixels` and `buildSceneViewCommands` take the registry as `colorOverrides`. `ColorOverrideRegistry` gains `has(id)` and `resolve(id, channel, base, tMs)`, the one resolution `createPathLayer` and the scene walks now share.

Path nodes also paint fill vertex colors from `data.vertexColors`, the same field `PathDrawCommand` uses.
