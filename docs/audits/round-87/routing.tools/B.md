# Audit round 87 — routing.tools

## A shared tool option that is not a number keeps only the first tool's schema, so the store repairs other tools' values away
- where: packages/routing/src/tools/toolOptionPrefs.ts:34 (widened), used at :101
- scenario: two tools share key `fill` as an `enum` (or a `string` with `maxLength`, or one tool declares it a number and the other an enum). `widened` returns `held` unchanged for anything but two numbers, so the shared leaf carries only the first tool's `options`/`maxLength`. When the second tool writes a value only its own leaf allows, the prefs store's `repairPrefValue` (`repair.ts:52-56`: an enum value not in `options` reads `leaf.default`; a string is sliced to `maxLength`) turns it into the first tool's default or a truncated string. The doc says the widened leaf exists "so a store repairing against it keeps what any tool may write"; that holds only for numbers. Should union enum options, take the larger `maxLength`, and throw on a kind mismatch.
- evidence: read
- severity: medium

## The step actions and the option tuning decide "the live tool" two different ways
- where: packages/routing/src/tools/toolOptionSteps.ts:46 (enabledFor) vs packages/routing/src/tools/tuneToolOptions.ts:30
- scenario: `tuneToolOptions` reads `liveTool(activeTool, ids)`, skipping held ids that are not this canvas's tools; `enabledFor` calls `liveTool(deps?.activeTool)` with no `among`, so the top of the hotkey stack always wins. The hotkey stack can sit in a provider shared above this canvas (`useTools.ts` says so). Say tool `brush` is active, and another canvas or an `engageHotkey` holds a tool this canvas does not register. The tuning still feeds `brush`'s size into its action, but `brush.grow`/`brush.shrink`/`brush.wheelSize` report `NotApplicable`, so `[` `]` and Shift+wheel do nothing while the options row shows `brush`'s size as live. One question answered two ways; both should use the same `among`.
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

<!-- done: 2 findings, files read: 25 -->
