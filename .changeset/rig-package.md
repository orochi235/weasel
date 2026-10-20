---
"@weasel-js/rig": patch
"@weasel-js/core": patch
---

New package, `@weasel-js/rig`: the bone and weight tools, with the actions they bind, moved out of
core. `useRigTools({ scene })` builds both for `<SceneCanvas tools>`, keyed by the ids `RIG_TOOLS`
names; they act on the rig the scene's selection names unless given `selection` or `rig`, and take
`state`, `reach` and `radius` as `toolOptions.rig` and `toolOptions.weight` used to. `useBoneTool`,
`useWeightTool`, `createRigEditState`, `placedRig`, `rigOfSelection`, the two overlays and
`weighedPaths` come from it too, and its glyphs are `rig:bone` and `rig:weight`.

**Breaking for core:** `<SceneCanvas>` no longer mounts the rig tools. `'bone'` and `'weight'` are
gone from `BuiltinToolId`, `BUILTIN_TOOLS` and `BUILTIN_TOOL_IDS`, `RIG_TOOLS` and every name above
are gone from core's barrel, and so are `toolOptions.rig`, `toolOptions.weight` and the
`core:bone` and `core:weight` glyphs. The kit settings `targets.boneJointRadiusPx` and
`targets.weightPointRadiusPx` keep their paths, but are declared by `@weasel-js/rig` and listed in
its `rigKitSettingsSchema` rather than `coreKitSettingsSchema`. Core keeps the rig itself:
`useRigNode`, `bindRig`, `placeSkeleton` and the rest bind a skeleton from scene data as before.
