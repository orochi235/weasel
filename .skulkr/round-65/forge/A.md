## A CSF argType `if` condition ignores frame-local args, so a control stays shown (or hidden) by a value the story no longer renders with
- where: packages/forge/src/csf/argsToSchema.ts:334 (argsToSchema, `read`) and :301 (conditionOf)
- scenario: a story has args `{ mode: 'a' }` and argTypes `{ detail: { if: { arg: 'mode', exists: true } } }`. A decorator or the render calls `updateArgs({ mode: undefined })` (or sets `mode` to a function / class instance). `useArgs` keeps that value frame-local (`preview-api.ts:30`, `setLocal`) and never sends it to config, so the story now renders with `mode` absent. The `showIf` predicate built by `conditionOf` reads only `config` then the story's own `args` through `read`, so `mode` still reads as `'a'` and `detail` stays shown. Storybook evaluates `if` against the args the story renders with and hides `detail`. The panel and the story answer "what is `mode`" two different ways; the same holds for `eq`/`neq`/`truthy` against a local value.
- evidence: read (`read` is `getOwn(config, arg)` falling back to `getOwn(args, arg)`; the local args live only in `Scoped`'s React state in `loadCsfModule.tsx:121`, and `answerSchema` in `protocol/schema.ts:184` evaluates predicates against the config record alone)
- severity: low

## A render with a default or rest parameter loses its component's prop-derived controls
- where: packages/forge/src/csf/loadCsfModule.tsx:170 (loadCsfModule, `fromProps`)
- scenario: `render: (args = {}) => <Button {...args} />` or `render: (...a) => <Button {...a[0]} />`. `Function.length` counts only parameters before the first default or rest, so it is 0, and the heuristic "a render that takes no args" drops `__forgeArgTypes`. The story reads its args, but gets no controls for the meta `component`'s props. It should still get them: the render does take args.
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

<!-- done: 2 findings, files read: 29 -->
