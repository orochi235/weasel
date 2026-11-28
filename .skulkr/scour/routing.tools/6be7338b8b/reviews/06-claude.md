# routing.tools findings

## describeShortcuts reads tool-declared bindings without the binding overrides in force, so a rebound tool binding reads at its declared key
- where: packages/routing/src/tools/describeShortcuts.ts:126 (toolBindingsByAction / describeShortcuts)
- scenario: a brush tool with `options.size` gets `brush.grow` bound to `]` through `Tool.bindings` (binding id `brush.grow.key`). The host rebinds that id with `bindingOverrides` to `=`. Dispatch applies the override to tool bindings by owner id (`contributions/assemble.ts:28`, `overriddenBindings(entry.bindings, entry.id, overrides)`), and `findScopedConflicts` does the same, so `=` is what fires. `describeShortcuts` merges `actionBindings(action)` (from `registry.list()`, overrides applied) with raw `tool.bindings`, so the sheet still lists `]` for "Grow Brush", and an unbound one stays listed. The module doc promises "a rebound key reads rebound and an unbound one is gone"; tool rows (via `toolShortcutsOf` on `tool.activate`) do honor overrides, so one sheet answers "which bindings are in force" two ways.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts (take `overrides?: ResolvedBindingOverrides` in `DescribeShortcutsOptions` and run each tool's bindings through `overriddenBindings(b, toolId, overrides)`), plus callers that build the sheet
- size: function
- cause: overrides not applied to tool-owned bindings
- confidence: likely

## addConflict's dedupe key omits owners, so two distinct ties among bindings sharing one spec object collapse into one conflict
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:144 (addConflict)
- scenario: four ambient tools A, B, C, D each bind the same spec constant (`const ESC = { kind: 'key', key: 'Escape' }`) to different actions; A and B carry `opts.views: ['x']`, C and D `opts.views: ['y']`. `tieComponents` yields two components, [A,B] and [C,D]. Their key is `compositeKey([gesture, target, id(ESC), mods, id(ESC), mods])` for both, so the second only adds a platform to the first and is dropped: `findScopedConflicts` reports A/B and never C/D. The same happens with any spec object shared across owners (e.g. specs built once in a module and reused, as `STEP_KEYS` is).
- evidence: read
- severity: low
- fix: include each member's `ownerId` (and binding index) in the key
- size: line
- cause: conflict key built from spec identity only
- confidence: likely

## A hotkey-tier action shadowing an ambient tool's binding is never reported, though the same shadow over a registry tool is
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:302 (findScopedConflicts)
- scenario: an action with `scope: 'hotkey'` and a default `Escape` binding, and an always-on ambient tool binding `Escape` to its own action. The hotkey tier is walked before ambient, so the ambient binding fires only when the action declines, the exact situation the `shadows` report describes. The shadow loop pairs hotkey actions only with `registry` tools; `ambient` (ambient tools plus ungated actions) is never compared with `hotkeyActions`/`gatedHotkey`, and the hotkey group holds only registry tools. Result: no warning for the ambient case, a `shadows` warning for the identical registry case.
- evidence: read
- severity: low
- fix: iterate `[...registry, ...ambient]` (and keymaps) in the shadow loop
- size: line
- cause: shadow pass limited to registry tools
- confidence: likely

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

<!-- done: 3 findings, files read: 25 -->
