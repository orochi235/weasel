# @weasel-js/rig

## 1.12.0

### Patch Changes

- c697535: Every binding the kit ships now declares an id, so a binding override names it by that id rather
  than by its owner and position: `undo.key`, `rect.drag`, `nudge.left.big`, `selection.rotate.handle`,
  `tool.activate.rect`. The scheme is `<owner>.<role>`, the owner being the action for an action's own
  binding and the tool or entry for a contribution's (`docs/taxonomy.md`, "binding override"). An
  override written against a positional id such as `select#3` no longer reaches its binding.
  
  An action's `defaultBinding` that was a bare spec is now a one-entry `{ spec, opts: { id } }` array;
  code reading `defaultBinding` as a spec reads it through `actionBindings`.
- Updated dependencies [dbd6711]
- Updated dependencies [f6db995]
- Updated dependencies [0996ce6]
- Updated dependencies [3716e73]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [1cc3d07]
- Updated dependencies [78f29de]
- Updated dependencies [2cf7da4]
- Updated dependencies [92a0f2d]
- Updated dependencies [448065a]
- Updated dependencies [c697535]
- Updated dependencies [c2fb65c]
- Updated dependencies [94ebd35]
- Updated dependencies [24f2495]
- Updated dependencies [929736f]
- Updated dependencies [d9fd036]
- Updated dependencies [f461572]
- Updated dependencies [3bf5edb]
- Updated dependencies [92b8df8]
- Updated dependencies [91a1d84]
- Updated dependencies [eec50d7]
  - @weasel-js/geom@1.12.0
  - @weasel-js/routing@1.12.0
  - @weasel-js/core@1.12.0
  - @weasel-js/renderer@1.12.0
  - @weasel-js/react@1.12.0
  - @weasel-js/animator@1.12.0
  - @weasel-js/prefs@1.12.0
  - @weasel-js/history@1.12.0
  - @weasel-js/icons@1.12.0
  - @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- 683dea0: New package, `@weasel-js/rig`: the bone and weight tools, with the actions they bind, moved out of
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
- Updated dependencies [70b12d1]
- Updated dependencies [3b5750f]
- Updated dependencies [768be71]
- Updated dependencies [9390be4]
- Updated dependencies [1dd65f5]
- Updated dependencies [411b629]
- Updated dependencies [267d5e4]
- Updated dependencies [922cddf]
- Updated dependencies [d5a4102]
- Updated dependencies [9cd12f7]
- Updated dependencies [e5ba382]
- Updated dependencies [8e317f5]
- Updated dependencies [abf41a7]
- Updated dependencies [312eb35]
- Updated dependencies [7ffc196]
- Updated dependencies [25a112b]
- Updated dependencies [4d99526]
- Updated dependencies [853ce69]
- Updated dependencies [5cdc3d0]
- Updated dependencies [8c1861a]
- Updated dependencies [6440997]
- Updated dependencies [44cf2c5]
- Updated dependencies [8ff750f]
- Updated dependencies [161c9c4]
- Updated dependencies [33fa471]
- Updated dependencies [2eb0370]
- Updated dependencies [c726003]
- Updated dependencies [e30f4df]
- Updated dependencies [8c2a9a9]
- Updated dependencies [1156d63]
- Updated dependencies [13fc67f]
- Updated dependencies [adadf5e]
- Updated dependencies [b3aa7cb]
- Updated dependencies [50da815]
- Updated dependencies [995eac7]
- Updated dependencies [ee2f0fc]
- Updated dependencies [716561f]
- Updated dependencies [ee4cf85]
- Updated dependencies [d892435]
- Updated dependencies [1a1bb83]
- Updated dependencies [0e24110]
- Updated dependencies [c2dfd4e]
- Updated dependencies [0f455dc]
- Updated dependencies [4bf5dec]
- Updated dependencies [15efc86]
- Updated dependencies [fe2a8c5]
- Updated dependencies [8cd81e7]
- Updated dependencies [b7e6edc]
- Updated dependencies [c29ac84]
- Updated dependencies [87cded1]
- Updated dependencies [07b686c]
- Updated dependencies [24267d3]
- Updated dependencies [041bc38]
- Updated dependencies [683dea0]
- Updated dependencies [61e7b0c]
- Updated dependencies [f819e61]
- Updated dependencies [5053f5b]
- Updated dependencies [2b267d5]
- Updated dependencies [8f2c044]
- Updated dependencies [ac892f8]
- Updated dependencies [71d4416]
- Updated dependencies [cee04b9]
- Updated dependencies [e1eeb08]
- Updated dependencies [f148f50]
- Updated dependencies [1bb4752]
- Updated dependencies [e9404d0]
- Updated dependencies [433540d]
  - @weasel-js/routing@1.11.1
  - @weasel-js/core@1.11.1
  - @weasel-js/animator@1.11.1
  - @weasel-js/renderer@1.11.1
  - @weasel-js/history@1.11.1
  - @weasel-js/geom@1.11.1
  - @weasel-js/react@1.11.1
  - @weasel-js/prefs@1.11.1
  - @weasel-js/icons@1.11.1
  - @weasel-js/registry@1.11.1
