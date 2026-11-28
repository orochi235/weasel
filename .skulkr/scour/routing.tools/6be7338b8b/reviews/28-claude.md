## describeShortcuts lists tool-declared bindings without the binding overrides in force, so a rebound tool key reads as its declared key
- where: packages/routing/src/tools/describeShortcuts.ts:131 (toolBindingsByAction), :154 (describeShortcuts)
- scenario: a tool declares `{ spec: { kind: 'key', key: ']' }, actionId: 'brush.grow', opts: { id: 'brush.grow.key' } }` (every `toolOptionSteps` binding is one) and the host rebinds it through `bindingOverrides`. At runtime `assemble.ts:28` routes the tool's bindings through `overriddenBindings(entry.bindings, entry.id, overrides)`, so the new key fires. But `describeShortcuts` reads `tool.bindings` raw and takes no overrides, so the sheet still shows `]` (and a binding unbound by override still shows). The module's own doc says "a rebound key reads rebound and an unbound one is gone". `describeKeymap` and `findScopedConflicts` both take `overrides` and apply them to entry bindings; this path answers the same question a second way.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: overrides not applied to tool bindings
- confidence: likely

## toolOptionsPrefs makes an untitled group for a dotted tool id's parent segment
- where: packages/routing/src/tools/toolOptionPrefs.ts:84 (placeToolGroup)
- scenario: a tool `path.brush` has options and no tool `path` has any. `placeToolGroup` creates the intermediate `path` node as `{ name: '', children: {} }`, and nothing ever names it. A prefs panel drawing the schema shows a group with an empty heading above the brush's options. The name should come from somewhere (the segment, `groupTitle`-style), not be blank.
- evidence: read
- severity: low
- size: line
- cause: placeholder group name never filled
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

<!-- done: 2 findings, files read: 25 -->
