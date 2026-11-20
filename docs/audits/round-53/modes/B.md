# Audit round 53 — area `modes`

## `isShippedTag`'s type guard narrows a non-shipped string to `never`
- where: packages/modes/src/capabilities.ts:39 (isShippedTag)
- scenario: `CapabilityTag` is `(typeof SHIPPED_TAGS)[number] | (string & {})`, which every `string` is assignable to, so the predicate `value is CapabilityTag` does nothing in the true branch. In the false branch TypeScript strips everything assignable to `CapabilityTag` from `string`, so the value becomes `never`. A caller doing `if (!isShippedTag(tag)) warn(\`unknown tag ${tag.length}\`)` — the case the docstring describes, "an app-defined tag ... will answer `false`" — gets a type error, or loses all checking on `tag`. The guard should narrow to `(typeof SHIPPED_TAGS)[number]`, or the function should return a plain `boolean`.
- evidence: read (TypeScript's narrowing rule for a type predicate's false branch; I could not run tsc in this sandbox to confirm)
- severity: low

## PATH_EDIT's doc says it starts on "core's `anchors` tool", but that tool lives in path-tools
- where: packages/modes/src/presets/default.ts:27-29 (PATH_EDIT docstring)
- scenario: the `anchors` tool (`ANCHORS_TOOL_ID = 'anchors'`) is defined in `packages/path-tools/src/pathEdit/anchorsTool.ts`. Commit 6d2bb1ef64 moved it there from core ("move path editing, ... to path-tools"), and core has no tool with that id. A consumer who reads the doc and mounts only core's tools gets a canvas where `defaultToolOf` returns null for path-edit, so entering the mode silently activates nothing. The doc should name `@weasel-js/path-tools`.
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
