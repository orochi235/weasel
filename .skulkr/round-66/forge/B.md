# Audit round 66 — forge

## A leaf's `default` crosses the port unsanitized, though its annotations are stripped to data
- where: packages/forge/src/protocol/schema.ts:138 (describeShape)
- scenario: a native story declares a leaf whose default holds a function (`f.custom('motif', { draw: () => … })`), or a class instance. `describeShape` runs `annotations`, `section` and `auto` through `dataOf`, but copies `default: entry.default` as it is. `startFrame` posts the description in `ready`; `postMessage` throws `DataCloneError` on the function, so the frame never sends `ready` and the story never opens. A class instance crosses as a plain object with its methods gone, so the workshop's default (used for reset and for `knobsToParams`'s at-default test) differs from the frame's. It should go through the same port-safe filter (`dataOf` / `portSafePart`) as everything else in the entry.
- evidence: read (describeShape vs FrameController.tsx:54's `send({ type: 'ready', schema: describeSchema(story.config) … })`)
- severity: medium

## An arg cleared or set to a frame-local value through `useArgs` still reads as its config value to `argTypes.if`
- where: packages/forge/src/csf/argsToSchema.ts:334 (argsToSchema `read`), packages/forge/src/csf/shims/preview-api.ts:29
- scenario: a story with argTypes `{ label: { if: { arg: 'icon', exists: true } } }` calls `updateArgs({ icon: undefined })`, or `updateArgs({ icon: <Svg/> })`. `updateArgs` keeps both in frame-local args and sends nothing, so the render's `args` lose `icon` (or get the element), while `read` answers from config and `args` alone and still sees the old `icon`. The `label` control stays shown although the story no longer has an icon. Render and control visibility answer "what is `icon`" two different ways.
- evidence: read
- severity: low

## `play` gets args without the frame-local ones, which its render sees
- where: packages/forge/src/csf/loadCsfModule.tsx:260 (play)
- scenario: a decorator calls `updateArgs({ onChange: fn })`, which stays frame-local. The render gets `onChange`, because `scoped` builds its context with `local`. But `play` calls `csfContext(config, globals)` with no `local`, so `context.args.onChange` in play is the story's original or absent. A play that asserts on or calls the arg it sees disagrees with what was rendered.
- evidence: read
- severity: low

## `if: { eq: undefined }` is tested as an equality, where Storybook ignores it
- where: packages/forge/src/csf/argsToSchema.ts:307 (conditionOf)
- scenario: Storybook's `testValue` checks `typeof eq !== 'undefined'` before using `eq`, so `{ arg: 'x', eq: undefined, truthy: false }` (as a spread of an optional value produces) falls through to the truthy test. forge's `'eq' in condition` takes the `eq` branch and compares against undefined, so the control is shown exactly when the arg is unset rather than when it is falsy. The same holds for `neq`.
- evidence: read (Storybook's behavior from memory of its `testValue`, not checked in this tree)
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
