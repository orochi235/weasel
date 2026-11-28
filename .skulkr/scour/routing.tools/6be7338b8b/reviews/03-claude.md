## describeShortcuts lists a tool's declared bindings without applying binding overrides, so a rebound tool key reads stale
- where: packages/routing/src/tools/describeShortcuts.ts:120 (toolBindingsByAction / describeShortcuts)
- scenario: a brush tool with `options.size` gets `brush.grow` bound to `]` on the tool's own `bindings` (defineTool → toolOptionSteps). The host rebinds it with `bindingOverrides` (binding id `brush.grow.key` → `=`). At runtime `assemble.ts:28` applies `overriddenBindings(entry.bindings, entry.id, overrides)` to the tool's bindings, so `=` fires. `describeShortcuts(registry.list(), { tools })` merges `tool.bindings` raw, so the sheet still shows `]` (and an unbound one still shows). The file's header promises "a rebound key reads rebound and an unbound one is gone"; the actions half holds because `list()` applied overrides, the tool half does not, and `DescribeShortcutsOptions` has no `overrides` field (describeKeymap and findScopedConflicts both take one).
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts
- size: function
- cause: overrides not applied to tool-declared bindings
- confidence: likely

## A shared number option held at ±Infinity reads as the default, not clamped, for a tool whose leaf is not endless
- where: packages/routing/src/tools/toolOptions.ts:141 (readHeld)
- scenario: tools A (size leaf `max: 500, endless: 'max'`) and B (size leaf `max: 500`, no endless) share `size`. A steps size to `Infinity` (steppedOption does this at the endless end). B reads the shared slot: `readHeld` rejects a non-finite number its own leaf does not allow and returns `undefined`, so B's params fall back to B's default (say 10) rather than 500. toolOptionsPrefs documents that "each tool reads it held to its own" bounds, and steppedOption itself treats a non-finite value as at the leaf's max/min; a finite 10_000 would read 500 while Infinity reads 10. Pressing `]` in B then writes `default+step` over A's value.
- evidence: read
- severity: low
- fix: packages/routing/src/tools/toolOptions.ts
- size: line
- cause: non-finite rejected before clamping
- confidence: likely

## findScopedConflicts looks an entry's eligible rule up by ownerId, so a tool sharing an id with a gated action inherits that action's rule
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:91 (findConflictsKeyed, ruleOf)
- scenario: `rules` is keyed by action id, but `ruleOf` reads `rules.get(entry.ownerId)` for every entry, tools and contributions included. A registry/ambient tool `text` beside a gated action `text` (eligible only in mode X) has its bindings treated as gated: two ambient entries colliding with the tool are then excused whenever the action's rule is exclusive with theirs (rulesExclusive / no mode lets both hold), and a real tie goes unreported. The comment says "Only actions carry a rule, so a tool's ... bindings count as eligible always", which the id lookup does not enforce.
- evidence: read
- severity: low
- fix: packages/routing/src/tools/routing/reflection/conflicts.ts
- size: function
- cause: tool and action ids share one key space
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
