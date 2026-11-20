# Audit round 55 — routing.tools findings

Note: the frozen commit `bfc55709b4b1c35343b8417dc8f74424b58d9714` is not present in this clone (`git cat-file` reports a bad object). The tree read is HEAD `830b463cc1`; nothing under `packages/routing/src/tools` is modified in the working tree.

## The tools slot goes empty when the last canvas to publish unmounts, though an earlier canvas is still mounted
- where: packages/routing/src/tools/toolsScope.tsx:16 (ToolsSlot.publish / set)
- scenario: two `<SceneCanvas>`es sit under one `WeaselProvider`, so they share one `ToolsSlot`. Canvas A publishes, then canvas B publishes and takes the slot. When B unmounts, its release sees `owner === B` and calls `set(null, null)`. The slot now holds nothing, though A is still mounted. `useScopedTools()` returns `null`, so `ToolPalette` and `ActiveToolOptionsBar` draw nothing. They stay blank until A's `ToolsApi` memo happens to change and its `usePublishTools` effect runs again, for example when the user switches A's active tool. Expected: the slot goes back to the most recent publisher still mounted, which here is A. Publishers have to be kept as a stack, not a single owner.
- evidence: read
- severity: medium

## A tool with the id `shared` shares one slot with the shared tool options
- where: packages/routing/src/tools/toolOptions.ts:100 (toolOptionSlot), packages/routing/src/tools/toolOptionPrefs.ts:70-78 (toolOptionsPrefs)
- scenario: `SHARED_TOOL_OPTIONS` is the plain string `'shared'`. Nothing reserves it as a tool id: `validateId` in defineTool.ts rejects only sigils and phase keywords, and `useTools` has no such check either. Take `defineTool({ id: 'shared', options: { prefs: { children: { fill: … } } } })`. Its own `fill` lands in `{ owner: 'shared', key: 'fill' }`, which is exactly the slot every other tool's shared `fill` uses, so the tool's private option silently becomes the shared one. `toolOptionsPrefs` then writes this tool's own group to `children['shared']` and overwrites it with the Shared group whenever any key is shared. The tool's other own options drop out of the schema, and the prefs store repairs or ignores them. Expected: per-tool owners and the shared owner never collide. Either reserve the id or keep shared values in a namespace no tool id can name.
- evidence: read
- severity: low

## Tool option values kept in prefs never read back for a tool id or shared key containing `.`
- where: packages/routing/src/tools/toolOptionPrefs.ts:82 (pathOf), :106 (prefsToolOptionValues.get); packages/routing/src/tools/toolOptionPrefs.ts:70 (toolOptionsPrefs)
- scenario: `validateId` allows dots in a tool id. Take a tool `path.brush` with an own option `size`, or a share key such as `style.fill`. `toolOptionsPrefs` makes one schema child named `path.brush`. `set` writes the path `tools.path.brush.size`. The store's `values()` builds its tree by splitting each name on `.` (packages/prefs/src/store.ts:99), so the value ends up at `tools → path → brush → size`. `get('path.brush')` does `getOwn(tree, 'path.brush')`, finds nothing and returns `NONE`. Every write is lost on read: the option always shows its default, and step keys keep stepping from the default. Expected: `get` reads back what `set` wrote for every id `defineTool` accepts. Either escape the segment or reject dots in ids and share keys.
- evidence: read
- severity: medium

## A tool held on its hotkey has its options tuned in, but its size/strength step keys and Shift+wheel are disabled
- where: packages/routing/src/tools/toolOptionSteps.ts:49 (enabledFor), compared with packages/routing/src/tools/tuneToolOptions.ts:31 (live)
- scenario: a brush tool declares both `hotkey` and `options.size`, and the user holds its key while `select` is the active tool. The brush's bindings are live at hotkey scope, including `brush.grow` on `]` and `brush.wheelSize` on Shift+wheel. `tuneToolOptions` counts the held brush as the live tool, so its size reaches the action. But `enabledFor` answers `NotApplicable` unless `activeTool.active === 'brush'`, so `[`/`]` and Shift+wheel do nothing while the brush is held. "Which tool's options are live" gets two different answers: the newest held tool, else the active one, in tuning, and the active one only in the step actions. Expected: the step actions are enabled for exactly the tool whose options are being tuned.
- evidence: read
- severity: low

## Files read
packages/routing/src/tools/defineTool.ts
packages/routing/src/tools/describeShortcuts.ts
packages/routing/src/tools/returnToModeDefault.ts
packages/routing/src/tools/routeTypes.ts
packages/routing/src/tools/routing/gestures.ts
packages/routing/src/tools/routing/index.ts
packages/routing/src/tools/routing/reflection/conflictKeys.ts
packages/routing/src/tools/routing/reflection/conflicts.ts
packages/routing/src/tools/routing/reflection/index.ts
packages/routing/src/tools/routing/reflection/registry.ts
packages/routing/src/tools/routing/routeGrammar.ts
packages/routing/src/tools/toolGaps.ts
packages/routing/src/tools/toolOptionPrefs.ts
packages/routing/src/tools/toolOptionSteps.ts
packages/routing/src/tools/toolOptions.ts
packages/routing/src/tools/toolSet.ts
packages/routing/src/tools/toolShortcuts.ts
packages/routing/src/tools/toolsScope.tsx
packages/routing/src/tools/tuneToolOptions.ts
packages/routing/src/tools/types.ts
packages/routing/src/tools/useModeDefaultTool.ts
packages/routing/src/tools/useToolLifecycle.ts
packages/routing/src/tools/useToolOptionValues.ts
packages/routing/src/tools/useToolShortcuts.ts
packages/routing/src/tools/useTools.ts

<!-- done: 4 findings, files read: 25 -->
