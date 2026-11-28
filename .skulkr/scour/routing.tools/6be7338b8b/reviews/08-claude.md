## describeShortcuts lists tool-declared bindings as authored, ignoring binding overrides
- where: packages/routing/src/tools/describeShortcuts.ts:126 (toolBindingsByAction), :154 (describeShortcuts)
- scenario: a brush tool with `options.size` gets `brush.grow` bound to `]` through its `Tool.bindings` (toolOptionSteps). A host rebinds or unbinds that binding through `bindingOverrides` (which apply to tool bindings by owner id; see `overriddenBindings(e.bindings, e.id, overrides)` in conflicts.ts). `ShortcutSheet` passes `tools.registry` raw (ShortcutSheet.tsx:89), and describeShortcuts concatenates `tool.bindings` onto the action's bindings unmodified, so the sheet still shows `]` (or a key now unbound). The module doc and ShortcutSheet's doc both promise "a rebound key reads rebound and an unbound one is gone"; that holds only for the action's own `defaultBinding`s.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: overrides applied to action bindings but not tool bindings
- confidence: likely

## ToolsApi.hotkeyEngaged can name another canvas's tool
- where: packages/routing/src/tools/useTools.ts:226 (useTools)
- scenario: two canvases share one `ActiveToolContext` hotkey stack (the code says "the stack can sit in a provider above this one", and toolOptionSteps' `LIVE_TOOL_PARAM` exists because "a hotkey stack shared with another canvas cannot say alone"). Canvas B pushes its tool `lasso`; canvas A's `useTools` returns `hotkeyEngaged: 'lasso'` (`ctx.hotkeyStack.at(-1)`), an id absent from A's `registry`, so `tools.registry[tools.hotkeyEngaged]` is undefined. The same api's `routed` filters the stack to its own entries (`routedTool` in useContributions), and `tuneToolOptions` filters it with `liveTool(..., ids)`. So the question "which tool is held" is answered two ways in one api.
- evidence: read
- severity: low
- size: line
- cause: hotkey stack top not filtered to own registry
- confidence: likely

## useToolOptionParams passes `values.subscribe` detached
- where: packages/routing/src/tools/useToolOptionValues.ts:35 (useToolOptionParams)
- scenario: `ToolOptionValues` is a public interface a host implements. A host that implements it as a class with a `subscribe(listener)` method using `this` gets the method handed to `useSyncExternalStore` unbound, so it is called with `this === undefined` and throws on mount. The kit's own implementations (`createToolOptionValues`, `prefsToolOptionValues`) happen to use closures, so tests pass.
- evidence: read
- severity: low
- size: line
- cause: method passed unbound
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
