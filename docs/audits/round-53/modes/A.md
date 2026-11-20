## `isShippedTag` narrows to `CapabilityTag`, which every string already is, so its true branch gains nothing and its false branch narrows to `never`
- where: packages/modes/src/capabilities.ts:39 (isShippedTag)
- scenario: `CapabilityTag` is `(typeof SHIPPED_TAGS)[number] | (string & {})`, and every `string` is assignable to it. A guard `value is CapabilityTag` on a `string` parameter therefore (a) leaves the true branch typed as a plain string-like `CapabilityTag`, so the documented use `if (isShippedTag(tag)) SHIPPED_TAGS.indexOf(tag)` (the example in `.changeset/modes-shipped-tags.md`) does not typecheck, because `indexOf` on the `as const` tuple takes only the literal union; and (b) narrows the false branch to `never`, so `if (!isShippedTag(s)) return s.length` is a type error. The predicate should be `value is (typeof SHIPPED_TAGS)[number]`, which is what "is one of the shipped tags" means.
- evidence: read (TypeScript narrowing rules; not compiled, since this tree has no node_modules)
- severity: medium

## The preset `ModeDefinition`s are shared mutable module objects, and a registry plus `createActiveModeReader` cache them without noticing changes
- where: packages/modes/src/presets/default.ts:5 (NORMAL, and every preset: `allows` is a plain mutable array, `DEFAULT_MODES` is not frozen); packages/modes/src/registry.ts:32 (createModeRegistry freezes only the list, not the definitions); packages/modes/src/registry.ts:78 (createActiveModeReader)
- scenario: an app customizes the shipped normal mode with `NORMAL.allows.push('edits-text')`, or `{ ...PATH_EDIT }` and then pushes onto the shared `allows` array. That changes the mode for every registry built from the preset on the page, including other canvases. A registry already built does not bump its version, so `createActiveModeReader` keeps serving the old `allowedCapabilities` set (it caches on `getVersion()`), while `isToolEligible` and `eligibleForMode` read the mutated `allows` live. The canvas gate and the palette then answer eligibility differently for the same tool. The presets should be frozen deeply (or the registry should copy them) so the mutation fails at the call that makes it.
- evidence: read
- severity: low

## Files read
packages/modes/src/capabilities.ts
packages/modes/src/decorations.ts
packages/modes/src/eligibility.ts
packages/modes/src/index.ts
packages/modes/src/modeDefinition.ts
packages/modes/src/pbt.fixture.ts
packages/modes/src/presets/default.ts
packages/modes/src/registry.ts
packages/modes/src/scopingLayer.ts

<!-- done: 2 findings, files read: 9 -->
