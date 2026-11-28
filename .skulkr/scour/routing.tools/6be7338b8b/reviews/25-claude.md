## Two separate tie components with the same spec objects share one conflict key, so the second conflict is dropped
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:146 (addConflict)
- scenario: one `findConflictsKeyed` pass whose bucket holds four bindings that use one shared spec constant (say a module-level `ESCAPE = { kind: 'key', key: 'Escape' }`): gated actions A and B under rule X, and C and D under rule Y, with X and Y mutually exclusive. `tieComponents` correctly returns {A,B} and {C,D}. But `addConflict` keys a conflict only by gesture, target and each member's `identityKeyOf(spec)` plus its modifiers, never by owner. Both components have two members with the same spec identity and modifiers, so they get the same key. The {C,D} call finds the {A,B} entry, only adds its platform, and returns. So the C/D conflict is never reported, and its platforms are counted toward A/B's in the one-platform `sameOutcome` filter. It should report two conflicts.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/routing/reflection/conflicts.ts
- size: line
- cause: conflict key omits entry identity / ownerId
- confidence: likely

## A dotted tool id whose parent has no options gets a prefs group with an empty name
- where: packages/routing/src/tools/toolOptionPrefs.ts:84 (placeToolGroup)
- scenario: `toolOptionsPrefs([pathBrushTool])` where the id is `path.brush` and no tool `path` has options. The intermediate segment `path` gets a placeholder `{ name: '', children: {} }`, and nothing ever names it. A prefs panel drawing the schema then shows an untitled group holding the brush's options. The group should carry a name, such as the segment itself or the parent tool's label.
- evidence: read
- severity: low
- size: line
- cause: placeholder group never named
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
