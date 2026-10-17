---
'@weasel-js/core': patch
---

`slice`, `bone`, and `weight` are built-in tool ids, so `<SceneCanvas defaultTools={['bone', 'weight']}>` or `tools={{ slice: true }}` mounts them, and `BUILTIN_TOOL_IDS` lists them after the shape tools. The canvas hands the rig tools its own scene and one `RigEditState` they share, and by default they edit the rig the selection names: with one node selected, the nearest of it and its ancestors holding `data.skeleton`, else that node itself. `toolOptions` gains `slice.closeHitRadius`, `rig` (`rig` to fix the node, `state` to share with `useRigNode`, `reach`), and `weight.radius`. This is additive; a canvas passing `defaultTools={BUILTIN_TOOL_IDS}` now mounts these three tools too.
