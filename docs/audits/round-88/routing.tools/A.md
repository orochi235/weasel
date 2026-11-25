## Two hotkey-capable tools with size/strength options are reported as a route conflict on `[` `]`, though only the live one's step can run
- where: packages/routing/src/tools/toolOptionSteps.ts:155 (toolOptionSteps), with packages/routing/src/tools/routing/reflection/conflicts.ts:277 (findScopedConflicts, hotkey group)
- scenario: a consumer gives two tools `options` with a `size` (say a brush and an eraser) and a `hotkey` on each. `toolOptionSteps` binds both tools' `grow` to the same unmodified `]` key spec (`STEP_KEYS.grow`, one shared object) with no `opts.yields`. `findScopedConflicts` puts every hotkey-capable registry tool in one group, the two bindings bucket together (same key, mods, rank, no views or phase, rules ALWAYS), their owners and action ids differ so `sameOutcome` is false, and `reportRouteConflicts` warns "declaration order alone decides which one fires" for `]`, `[`, `Shift+]`, `Shift+[` and Shift+wheel. In fact each step action's `enabled` (`enabledFor`) declines unless its tool is the live one, so the outcome never depends on order. The generated bindings should say so (`yields`) or the checker should know them, rather than warning on every dev mount.
- evidence: read
- severity: low

## The wheel-resize burst state lives in the tool definition, so every canvas and registry using that tool shares one burst
- where: packages/routing/src/tools/toolOptionSteps.ts:107 (wheelSizeAction, `travel` / `last`)
- scenario: `defineTool` runs once per def, and a tool built as a module constant (or memoized once and handed to two canvases) carries one `wheelSize` action whose `travel` and `last` are closure state. Shift+wheel on canvas A, then within 150 ms on canvas B, is read as one burst: B's first notch does not step at once (it only adds to `travel`, which needs 60 px), and leftover travel from A carries into B's count. Burst state should be per registry/canvas (e.g. kept per invocation context) rather than per definition.
- evidence: read
- severity: low

## A tool set or action group with the id `other` swallows the ungrouped rows under its own heading
- where: packages/routing/src/tools/describeShortcuts.ts:92 (describeTools) and :143 (describeShortcuts)
- scenario: `describeTools` keys groups by id and reuses `OTHER = 'other'` for tools in no set. Given `toolSets: [toolSet('other', ['x'], { label: 'Extras' })]`, every tool in no set is appended to that group and shown under "Extras", not "Other tools" as the doc promises, and the "Other tools" group never appears. Likewise an action with `group: 'other'` is merged with ungrouped actions under "Other". The fallback group needs a key no caller can choose.
- evidence: read
- severity: low

## A host's default for a shared option is not checked against the widened leaf
- where: packages/routing/src/tools/toolOptionPrefs.ts:128 (toolOptionsPrefs)
- scenario: `spec.shared` sets `{ ...leaf, default: value }` as given. A host passing `shared: { size: 500 }` where every tool naming `size` caps it at 100, or an enum value no tool lists, gets a prefs leaf whose own default is invalid; a store repairing values against the schema then repairs against an out-of-range default, and `readHeld` rejects the value each tool reads, falling back to the tool's own default instead of the host's. The default should be repaired (`repairPrefValue`) or rejected with an error, as a kind mismatch is.
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
