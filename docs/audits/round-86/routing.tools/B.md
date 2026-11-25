# Audit round 86 — routing.tools — findings

## useToolOptionValues throws outside a DepRegistryProvider, though its doc promises a silent no-op
- where: packages/routing/src/tools/useToolOptionValues.ts:15 (useToolOptionValues)
- scenario: a host calls `useToolOptionValues(store)` in a component with no `<DepRegistryProvider>` above it (e.g. beside the canvas rather than inside it). The doc says it "silently does nothing outside a `<DepRegistryProvider>`", but it calls `useDepSource`, which calls `useDepRegistry()` (interactions/actions/depRegistry.tsx:24), and that throws `useDepRegistry: no DepRegistryProvider in scope`. The render crashes instead of no-oping. The neighbors in this file (`useCanvasToolOptionValues`, `useToolOptionTunings`) use `useOptionalDepRegistry` and do no-op, so this is one question answered two ways.
- evidence: read
- severity: medium

## steppedOption can step an off-grid value backwards when the scaled move is smaller than the snap
- where: packages/routing/src/tools/toolOptions.ts:208-213 (steppedOption)
- scenario: leaf `{ kind: 'number', step: 1 }`, step `{ option: 'size', times: 1.005 }`, value 10.4, dir 1 (`]`). `scaled` = 10.452, `snapped` = round(10.452) = 10. The "rounds back to where it began" guard only catches `|snapped - value| < step·1e-6`, and |10 − 10.4| = 0.4, so `stepped` = 10. The clamp and tidy pass return 10, and a "grow" lowers the size. The same thing happens with `plus` smaller than half of `leaf.step`. Off-grid values can reach this function: neither `repairPrefValue` nor `prefClampNumber` snaps to `step`, so a typed value, an off-grid default, or a shared value written by a tool with another `step` all arrive unsnapped. Expected: a step moves at least to the next grid point in `dir` (snap with ceil for dir 1 and floor for dir −1, or reject a snapped result with `(snapped − value)·dir ≤ 0`).
- evidence: read (worked by hand, not run)
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

<!-- done: 2 findings, files read: 25 -->
