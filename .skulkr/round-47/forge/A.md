I couldn't write `.skulk/out/findings.md` because permission was denied, so the whole document follows here.

# Audit round 47: forge

## A Storybook number control with only `min` (or only `max`) loses its bound, though labkit can hold one
- where: packages/forge/src/csf/argsToSchema.ts:170-188 (`hasRange`, `warnUnusableBounds`, `bounded`)
- scenario: `argTypes: { count: { control: { type: 'number', min: 0 } } }`, a common Storybook form. `hasRange` needs both bounds, so `bounded` applies neither; the field accepts -5, and the story's author is warned that the bounds "are not both finite and in order". Storybook applies a lone `min` to its number input, and labkit has `NumberNode.min()` / `.max()` (`packages/labkit/src/config/numberNode.ts:15-22`) for exactly this. It should apply the lone bound with `.min()` / `.max()`, and warn only for a bound that is NaN, or for `min` above `max`. The 2026-11-16 ruling in `docs/unruled.md` is about bounds that would make `range()` throw (`Infinity`, NaN, out of order). A lone finite bound never reaches `range()`.
- evidence: read
- severity: medium

## A `select`/`radio` control whose `options` are not all strings disappears, and with no control type it becomes a free field
- where: packages/forge/src/csf/argsToSchema.ts:71-74 (`stringOptions`), 211-225 (`controlled`)
- scenario: `argTypes: { size: { control: 'select', options: [8, 12, 16] } }` with `args: { size: 12 }`. `stringOptions` returns null, so for `control.type === 'select'` the result is `null` and the key gets no control at all. The arg can't be edited, and nothing warns. The same `options` with no `control` instead falls through to `structured`, which gives a number field that accepts any number. Storybook offers a choice of 8/12/16 in both cases. So one input shape gets two different answers, and neither one is a choice. Options could be kept as a choice by labeling each with `String(o)` and mapping back to the original value. Failing that, forge should at least warn when it drops the control.
- evidence: read
- severity: medium

## A URL param for an object or union knob is accepted with any fields and any tag
- where: packages/forge/src/route/url.ts:76-92 (`codecOf`), 116-127 (`fits`)
- scenario: argsToSchema builds `ObjectNode` (kind `object`) and `UnionNode` (kind `union`) leaves from an argType's `type`. `codecOf` doesn't list these kinds, so they fall through to the default's type and become `'json'`. `fits` then checks only `isPlainObject(value)`. So `#/story?look={"kind":"nope"}` on a union knob, or `?pos={"x":"abc"}` on an object knob whose `x` is a number field, decodes and goes into config. The story then renders with an unknown variant tag, or a string where its number field expects a number. `fits` is documented as refusing "a well-formed param of the wrong type", and it does so for list items, but not for an object's fields or a union's tag (`annotations.children` / `annotations.tag` + `annotations.variants` are available on the leaf).
- evidence: read
- severity: low

## `weaselforge build --out` overrides a config's own `build.emptyOutDir: true`
- where: packages/forge/src/cli/cli.ts:28, packages/forge/src/cli/policy.ts:16 (`outDirPolicy`)
- scenario: a vite config sets `build: { emptyOutDir: true }` so that an outDir outside its root still gets cleared, and the user runs `weaselforge build --out ../site-dist`. `outDirPolicy` returns `emptyOutDir: false`, since the outDir is not inside the root, and `build()` is called with that inline value, which wins over the config file. Stale files from earlier builds stay in `../site-dist`, and nothing says the setting was dropped. The config's explicit `emptyOutDir` should be respected (the only case to refuse is an outDir containing the cwd), and the policy should decide only where the config gives no value.
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

<!-- done: 4 findings, files read: 28 -->