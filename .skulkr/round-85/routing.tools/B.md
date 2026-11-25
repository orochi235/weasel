# Audit 85 — routing.tools (reviewer findings)

## ToolsSlot hands the shared slot to whichever canvas last re-published, not the one that joined last
- where: packages/routing/src/tools/toolsScope.tsx:19 (ToolsSlot.publish) / :55 (usePublishTools)
- scenario: canvases A then B mount under one `ToolsScope`; the slot shows B (joined last, as the doc says). The user picks a tool in A, so A's `ToolsApi` gets a new identity; `usePublishTools`' effect cleanup drops A and the re-run `publish` pushes A to the end of `published`, so `show()` switches the slot to A. A palette following the scope flips to A's tools on every tool change in either canvas, rather than staying with the newest mounted canvas. Re-publishing should replace the owner's entry in place.
- evidence: read
- severity: medium

## A panel value clamped to the leaf's default is dropped instead of written
- where: packages/routing/src/tools/toolOptions.ts:136 (readHeld), used by keepToolOptions:189
- scenario: number option `{ default: 100, max: 100 }`, current stored value 50. The last-operation panel sets 200; `repairPrefValue` clamps to 100, which equals the default but not the held 200, so `readHeld` returns `undefined` and `keepToolOptions` writes nothing. The option stays 50 although the user pushed it to its maximum; it should store 100. The "repaired to default means unreadable" test cannot tell a clamp from a rejection.
- evidence: read
- severity: low

## A `times` step never moves an option off 0
- where: packages/routing/src/tools/toolOptions.ts:198 (steppedOption)
- scenario: a size option with `size: { option, times: 1.25 }`, no `leaf.step`, no positive `min`, value 0 (also the fallback `leaf.default ?? 0` in toolOptionSteps' stepOption). `0 * 1.25 ** dir` is 0, the step guard only applies with `leaf.step`, so `[`/`]` and the wheel return 0 and stepOption writes nothing: the size is stuck at 0. Likewise `+Infinity` stepped down with no `max` returns `leaf.max ?? value` = Infinity, stuck.
- evidence: read
- severity: low

## `useTools` throws mid-life when the initial `active` tool leaves the registry
- where: packages/routing/src/tools/useTools.ts:175 (useTools)
- scenario: `useTools({ active: 'select', registry })` where a later render's registry no longer has `select` (a host swapping tool sets). `active` is documented as the initial tool only, but the `Object.hasOwn(opts.registry, initialActive)` check runs every render, so the canvas throws `useTools: active "select" not in registry` although the slot holds another tool. The check should apply to the seeding render only.
- evidence: read
- severity: low

## The shortcut sheet never lists keys a tool binds itself, including the option-step `[` `]` keys
- where: packages/routing/src/tools/describeShortcuts.ts:132 (describeShortcuts)
- scenario: `defineTool` with `options.size` registers `<tool>.grow` / `.shrink` and binds `[` `]` on `Tool.bindings` (toolOptionSteps). `describeShortcuts(registry.list())` reads keys only through `actionShortcuts`, i.e. the actions' own bindings, so these step actions (and any tool-bound key, e.g. polygon's side keys) produce no command row, though the module claims to list "every key live in an actions scope".
- evidence: read (inference that `actionShortcuts` reads only action-level bindings, from its use with `actionBindings`)
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

<!-- done: 5 findings, files read: 25 -->
