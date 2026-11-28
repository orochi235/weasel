## useToolOptionParams passes `values.subscribe` unbound, so a class-based ToolOptionValues throws
- where: packages/routing/src/tools/useToolOptionValues.ts:35 (useToolOptionParams)
- scenario: a host implements the public `ToolOptionValues` interface as a class whose `subscribe(listener)` reads `this` (e.g. `return this.emitter.subscribe(listener)`) → `useSyncExternalStore(values.subscribe, …)` calls it detached, `this` is undefined, and the options row throws on mount. Should bind (`(l) => values.subscribe(l)`) as `prefsToolOptionValues` does for its own store.
- evidence: read
- severity: low
- fix: packages/routing/src/tools/useToolOptionValues.ts
- size: line
- cause: method reference passed unbound
- confidence: likely

## toolOptionsPrefs throws for a tool listed twice, which useTools allows (same object in registry and ambient)
- where: packages/routing/src/tools/toolOptionPrefs.ts:96 (placeToolGroup)
- scenario: a host builds its prefs from `[...Object.values(registry), ...ambient]` where one optioned tool is in both, as `useTools` explicitly permits → the second pass finds its own group already placed, `Object.hasOwn(below, key)` is true for each of its own option keys, and it throws "option X and the tool `id.X` would share one place". Should skip a tool id already placed (or compare to the same tool).
- evidence: read
- severity: low
- fix: packages/routing/src/tools/toolOptionPrefs.ts
- size: function
- cause: no dedupe by tool id
- confidence: likely

## A shared number's widened leaf keeps the first tool's `clearable`, `scale`, `stops` and `step`, which may not hold over the merged range
- where: packages/routing/src/tools/toolOptionPrefs.ts:58 (widenedNumber)
- scenario: tool A declares shared `size` as `{ min: 1, max: 100, scale: 'log' }`, tool B as `{ min: 0, max: 50, clearable: true }` → the shared leaf is `{ min: 0, max: 100, scale: 'log' }` without `clearable`: B clearing its field writes `undefined`, which the store's `repairNumber` reads as the default, so B can never clear; and the log scale now spans 0, which warns and draws linear. Widening widens bounds only; the other fields that constrain what a value may be are taken from whichever tool came first.
- evidence: read (repairNumber in packages/prefs-schema/src/repair.ts:129 rejects non-numbers)
- severity: low
- size: function
- cause: only min/max/endless widened
- confidence: likely

## withToolOptionDefault accepts a default the leaf rejects, unlike the host's shared defaults
- where: packages/routing/src/tools/toolOptions.ts:83 (withToolOptionDefault)
- scenario: a tool hook passes its caller's `size: 1000` for a leaf with `max: 100` → the leaf's default becomes 1000; `toolOptionParams` hands 1000 to the action unclamped until something is written, and `toolOptionsPrefs` puts an out-of-range default into the prefs schema. `toolOptionsPrefs` validates a host's shared default with `repairPrefValue` and throws; this path answers the same question by not checking.
- evidence: read
- severity: low
- fix: packages/routing/src/tools/toolOptions.ts
- size: line
- cause: default not repaired against its leaf
- confidence: likely

## findConflicts merges non-tying bindings into one conflict through a third that ties with each
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:146 (tieComponents)
- scenario: three bindings on one tuple with `views` `['x']`, `['x','y']`, `['y']` → the first ties the second (view x) and the second the third (view y), but the first and third never meet; the connected-component walk reports one conflict naming all three owners as if they all tie. Should report pairwise (or maximal-clique) sets, not transitive closure.
- evidence: read
- severity: low
- size: function
- cause: transitive closure over a non-transitive relation
- confidence: sure

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

<!-- done: 5 findings, files read: 25 -->
