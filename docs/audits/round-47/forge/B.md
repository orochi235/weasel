# Audit round 47 — forge (blind reviewer)

## `updateArgs({ key: undefined })` puts the story's own arg back instead of clearing it
- where: packages/forge/src/csf/shims/preview-api.ts:39 (useArgs → updateArgs); packages/forge/src/csf/loadCsfModule.tsx:187 (csfContext)
- scenario: a story with `args: { value: 'x' }` whose render calls `updateArgs({ value: undefined })` (e.g. a Clear button). `undefined` is sendable, so it goes out as `setConfig('value', undefined)`, and a config `undefined` means "the story's own arg" (`ArgsScope.config` doc): `csfContext` drops it in `withArgs` and spreads `args` under it, so the render gets `'x'` again. Storybook's args store runs `deleteUndefined({...current, ...update})`, so there the arg is removed and the component gets `undefined`. forge's own `withoutUndefined` comment cites that same Storybook rule, but the shim turns a clear into a reset.
- evidence: read
- severity: medium

## `describeSchema` copies function-valued annotations into the `ready` message, which a port cannot clone
- where: packages/forge/src/protocol/schema.ts:66 (describeShape, `annotations: { ...entry.annotations }`)
- scenario: a forge story whose `f.schema` holds `f.action(run)` (labkit stores `run` in annotations, `compound.ts:149`), an object or union leaf with `.summary(fn)`, a number with `.scale({ to, from })`, or a function unit. `describeShape` spreads every annotation into the description, functions included, and `startFrame` posts it in `ready` (`FrameController.tsx:57`); `postMessage` throws `DataCloneError`, so the frame never reaches `ready` and the story cannot open. The node-level `render` and `validate` are handled (flagged and kept in the frame, with a test that `structuredClone(d)` round-trips), but annotation functions are not filtered at all, nor are those inside `item`/`children`/`variants`.
- evidence: read (labkit `ActionNode`/`f.action`, `Annotations.summary`, `PrefNumberScale`)
- severity: medium

## A `select` or `radio` control whose options are not all strings draws no control at all
- where: packages/forge/src/csf/argsToSchema.ts:215 (controlled, `select`/`radio`/`inline-radio` case)
- scenario: `argTypes: { size: { control: 'select', options: [8, 16, 24] } }` with `args: { size: 16 }` (or a mixed list such as `['auto', 0]`). `stringOptions` returns null for any non-string option, and the case then returns `null` for every explicit control type (only `control.type === undefined` falls back to `structured`), so `argsToSchema` skips the key: the arg renders at 16 with no row in the panel and no URL param, where Storybook offers the three choices. The same arg with no `control` named falls back to a number field, so the explicit control does strictly worse than none. The number fallback is a one-line change; drawing the choices needs an enum over the options' strings mapped back.
- evidence: read
- severity: low

## A CSF story's `globals` are read for the viewport only; the story renders under the toolbar's globals regardless
- where: packages/forge/src/csf/loadCsfModule.tsx:177 (loadCsfModule, `storyGlobals`), 199/244 (csfContext gets `ctx.globals` only); packages/forge/src/csf/types.ts:50 (`CsfShared.globals`, public)
- scenario: `export const Dark: StoryObj = { globals: { mode: 'dark' } }` (Storybook 9's per-story global override; `mode` declared in the shell config). `storyGlobals` is built from the meta's and story's `globals` but is handed only to `resolveViewport`; `LoadedStory` has no globals field, and `render`, decorators and `play` all get the trial's globals (`ctx.globals`), so the story renders in whatever mode the toolbar shows. The public `CsfShared` type offers `globals` with no caveat, and `csf/types.ts` says a field forge ignores is one a story should not be writing, so a story writing this one is told it works.
- evidence: read
- severity: low

## The schema description drops `enableIf`, `auto`, `resettable`, `motif` and `dialog`, so the workshop panel ignores them
- where: packages/forge/src/protocol/schema.ts:64 (describeShape reads only `section` and `showIf` from `entry.options`) and :93 (rebuildShape)
- scenario: a forge story with `f.number(1).enableIf((c) => c.on)`, or `.auto()` with an `autoResolve`, or a group with `.resettable()`. The frame describes each node by its annotations plus `section`, `showIf` (as `conditional`), `validate` and `render`; every other `NodeOptions`/`BranchOptions` field is left out, and the rebuilt schema the shell's panel draws has none of them. The row stays enabled whatever `enableIf` says, an auto leaf shows as a plain pinned value with no auto toggle, and the group heading has no reset. In a lab built on labkit directly (no port) the same schema behaves as written. `enableIf` can be answered through the answer book as `hidden` is; `resettable` and `autoQuote` are plain booleans that only need copying.
- evidence: read (labkit `config/types.ts` `NodeOptions`/`BranchOptions`)
- severity: medium

## A cleared clearable number writes no URL param, so the link reopens it at its default
- where: packages/forge/src/route/url.ts:199 (knobsToParams), :137 (decodeKnob, number)
- scenario: a story with `size: f.number(12).clearable()`; the user empties the field, which writes `undefined`. `knobsToParams` skips every `undefined` value as "at its default", so the hash carries no `size` param; reloading or sharing the link opens the story with `size` at 12, not empty. Nothing could carry it back either: `decodeKnob` refuses an empty number param. An explicit empty param (`?size=`) for a clearable leaf whose default is set would round-trip it.
- evidence: read
- severity: low

## An argType `if` on an arg that has no control reads it as undefined, so the conditioned control hides for good
- where: packages/forge/src/csf/argsToSchema.ts:234 (conditionOf), with :270 (args with no port-safe part get no leaf)
- scenario: `args: { icon: <StarIcon />, iconPosition: 'start' }`, `argTypes: { iconPosition: { control: 'radio', options: ['start', 'end'], if: { arg: 'icon' } } }`. `icon` is a React element, so `portSafePart` gives it no part and `argsToSchema` makes no leaf for it; the config the predicate reads therefore never holds `icon`, `getOwn(config, 'icon')` is `undefined`, and the truthy test hides `iconPosition` permanently. Storybook tests the condition against the story's args, where `icon` is set, and shows the control. The same goes for an arg kept frame-local by `updateArgs`. The predicate needs the story's `args` under the config (as `csfContext` builds them), not the config alone.
- evidence: read
- severity: low

## An arg holding a Proxy gets a control, and its default then fails the `ready` post
- where: packages/forge/src/csf/argsToSchema.ts:269 (`portSafePart`), packages/forge/src/csf/portSafe.ts:39 (isPortSafe); contrast packages/forge/src/csf/shims/preview-api.ts:8 (sendable)
- scenario: `args: { store: observable({ count: 1 }) }` (a MobX, Valtio or Vue reactive object, or any `new Proxy({}, …)`). `isPortSafe` reads the Proxy through its traps (plain prototype, enumerable string keys) and says yes, so `portSafePart` returns it whole and `argsToSchema` makes a JSON leaf whose default is the Proxy. `describeSchema` puts that default in `ready`, and `postMessage` throws `DataCloneError` (a Proxy is never cloneable), so the story does not open. `useArgs`' `sendable` knows this exact gap and adds a `structuredClone` probe, but only on the `updateArgs` path; the schema path answers the same question without it. Splitting would not help either: `splittable` also says yes for a Proxy, so its members would be copied out field by field instead of the arg being left in the frame.
- evidence: read (a Proxy is not serializable by the structured clone algorithm)
- severity: medium

## `runStory`'s doc says it renders with no globals, but it takes and applies `globals`
- where: packages/forge/src/test/runStory.tsx:62 (runStory docstring)
- scenario: the docstring says the story renders "the way the workshop does — defaults, no state, no globals", while `RunStoryOptions.globals` (added in 04ad0fd41a) is passed to `StoryGlobalsContext` and to `play`. A reader of the published `@weasel-js/forge/test` entry is told the option does nothing. (State is also seeded from `initialState` through `StoryTrial`, so "no state" is not quite right either.)
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

<!-- done: 9 findings, files read: 28 -->
