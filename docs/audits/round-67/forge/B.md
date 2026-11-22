## A control with one finite bound and one infinite bound loses both bounds
- where: packages/forge/src/csf/argsToSchema.ts:213 (boundsOf)
- scenario: argTypes `{ count: { control: { type: 'number', min: 0, max: Infinity } } }` (a common Storybook way to write "non-negative"). `boundsOf` returns `{}` as soon as either bound is unusable, so the leaf is built with no `min` either, and the warning says the control "is drawn unbounded". The field then accepts -5, and `decodeKnob` will not clamp a URL `?count=-5` either. The finite `min: 0` should be kept and only the infinite `max` dropped, which `bounded` already supports through `.min()`/`.max()` on their own. Same for `min: NaN, max: 10`.
- evidence: read
- severity: low

## configKey gives an array holding `undefined` the same key as one holding `null`
- where: packages/forge/src/protocol/messages.ts:167 (configKey)
- scenario: configs `{ items: [undefined] }` and `{ items: [null] }`. `tagged` passes `undefined` through, and `stableStringify` (via JSON) writes an `undefined` array member as `null`, so both get `{"items":[null]}`. The doc says configKey keeps apart what JSON would merge, and `portSafePart` keeps these two apart on purpose (portSafe.ts:105, "an `undefined` member crosses as itself"). Because answers (hidden/errors/disabled/resolved) and `LocalArg.over` (argsContext.ts `coverOf`) are keyed by configKey, a story whose `showIf`/`validate` treats the two differently gets one config's answers applied to the other. A frame-local arg set over one also keeps applying after config changes to the other.
- evidence: read (stableStringify in packages/core/src/core/stableStringify.ts:22 maps array members with no undefined handling; JSON.stringify writes them as null)
- severity: low

## A leaf's `.dialog()` is silently dropped when its schema crosses to the workshop
- where: packages/forge/src/protocol/schema.ts:136 (describeShape)
- scenario: a story schema leaf built with `.dialog({ body, ... })` (NodeOptions.dialog, labkit types.ts:234). `describeShape` describes `render` as `customControl`, `run` as `runsInFrame` and `autoResolve` as `resolves`, but writes nothing for `dialog`. `rebuildShape` never sets it, so the workshop's panel draws a plain row for the leaf instead of the button that opens the dialog, and nothing says it was dropped. The frame-side `body` renderer is code, so it needs a flag like `customControl` (or a request to the frame), not a silent drop.
- evidence: read
- severity: low

## Answer paths for keys containing a dot collide with nested paths
- where: packages/forge/src/protocol/schema.ts:84 (joinPath), used by rebuildShape:159, answerSchema:226 and schemaActionAt:202
- scenario: a story schema with a top-level key `"a.b"` next to a branch `a` that holds `b` (or just a CSF arg named `"data.id"`; argsToSchema puts arg keys into the schema as they are). Both entries get the path `"a.b"`, so `hidden`/`errors`/`disabled`/`resolved` answers for one are applied to the other, `schemaNodeAt(group, "a.b")` finds the wrong leaf (or none) to validate, and `schemaActionAt` splits on `.` and can never reach an action leaf whose key has a dot, so its button runs nothing. url.ts `knobPaths` already skips dotted keys for this reason (url.ts:262), so the protocol answers the same question a second way.
- evidence: read
- severity: low

## Files read
packages/forge/src/actionParamSchema.ts
packages/forge/src/cli/cli.ts
packages/forge/src/cli/parse.ts
packages/forge/src/cli/policy.ts
packages/forge/src/config.ts
packages/forge/src/csf/argsContext.ts
packages/forge/src/csf/argsToSchema.ts
packages/forge/src/csf/loadCsfModule.tsx
packages/forge/src/csf/portSafe.ts
packages/forge/src/csf/propArgTypes.ts
packages/forge/src/csf/shims/preview-api.ts
packages/forge/src/csf/types.ts
packages/forge/src/icons.gen.ts
packages/forge/src/index.ts
packages/forge/src/kitIcons.tsx
packages/forge/src/messageOf.ts
packages/forge/src/pbt.fixture.ts
packages/forge/src/play.ts
packages/forge/src/protocol/channel.ts
packages/forge/src/protocol/messages.ts
packages/forge/src/protocol/schema.ts
packages/forge/src/route/url.ts
packages/forge/src/test/index.ts
packages/forge/src/test/play.ts
packages/forge/src/test/runStory.tsx
packages/forge/src/testing/frame.ts
packages/forge/src/testing/loupe.ts
packages/forge/src/testing/shell.ts
packages/forge/src/title.ts

<!-- done: 4 findings, files read: 29 -->
