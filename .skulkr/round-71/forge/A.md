# Audit round 71, area forge, reviewer findings

## An argTypes-only arg typed `boolean`, `string` or `enum` gets no control, while one typed `number` does
- where: packages/forge/src/csf/argsToSchema.ts:278-281 (controlled, the `select`/`radio`/`undefined` case)
- scenario: a meta declares `argTypes: { disabled: { type: { name: 'boolean' } } }` (or `{ name: 'string' }`, or `{ name: 'enum', value: ['a', 'b'] }`) with no `args.disabled` and no `control`. `controlOf` gives `{ type: undefined }`, `optionChoice` is null, the number fallback at 278 is skipped, and line 281 returns `has ? structured(...) : null`, which is null because `has` is false, so the key gets no row. The same argType with `type: { name: 'number' }` takes the line-278 branch and gets a number control with the story's own default. Storybook infers a control from `argType.type` for all of these (boolean → boolean, string → text, enum → select), with or without an arg value. Expected: a typeless control with no arg infers its leaf from `argType.type` for every shape `shaped` can edit, as it already does for numbers.
- evidence: read (Storybook's `inferControls` behavior is from memory, not checked against its source here)
- severity: medium

## `weaselforge build --out <root>` still builds into the vite root itself
- where: packages/forge/src/cli/policy.ts:21-23 (outDirPolicy)
- scenario: cwd `/repo`, vite config `root: 'site'`, `weaselforge build --out site`. `outDir === rootDir`, so `holdsRoot` is true. That only turns `emptyOutDir` off: the policy returns `ok: true`, and vite writes the built `index.html` and assets over the root's source files. The equivalent case for the cwd (line 17) is refused. The docstring's "Never the root itself, or a directory holding it" reads as a refusal but applies only to emptying. Round 67 reported this; neither commit since (02fc4e425d, 6c28d1e3b7) changed it, and `docs/unruled.md` does not rule it. Expected: refuse an `--out` that is or holds the root, as for the cwd.
- evidence: read
- severity: low

## `sameKnob` treats an `undefined` list member as absent, so `[1, undefined]` equals `[1]` and `[undefined]` equals `[]`
- where: packages/forge/src/route/url.ts:287-289 (sameKnob)
- scenario: the undefined-member filter (`xo[key] !== undefined`) is meant for object fields, but it runs on arrays too, where the keys are indices. So `sameKnob([1, undefined], [1])` is true. Three effects: (a) `knobsToParams` writes no param for a list knob at `[1, undefined]` whose default is `[1]`, although `encodeKnob` would write `[1,null]`, so the URL drops the state; (b) an argType `if: { arg: 'xs', eq: [1] }` holds while `xs` is `[1, undefined]`; (c) `listWithUnsent` pairs a sent `[undefined]` entry with an original whose part is `[]`. `configKey` (protocol/messages.ts:137) keeps an `undefined` list member apart on purpose, so the two places that decide "same config value" disagree. Expected: arrays compare by length and by every index.
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

<!-- done: 3 findings, files read: 29 -->
