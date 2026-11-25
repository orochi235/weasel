I couldn't write `.skulkr/out/findings.md` because both the Write tool and a shell redirect were refused permission, so the whole findings document is below, as the brief allows.

```markdown
# Audit round 65 — forge (blind reviewer)

## A URL number knob outside its leaf's range is written into the config unclamped
- where: packages/forge/src/route/url.ts:186 (decodeKnob, `number` case); consumed by shell/RouteKnobs.tsx:42
- scenario: a leaf `f.number(5).range(0, 10)` (or a CSF `control: { type: 'range', min: 0, max: 10 }`) opened at
  `#/story?size=99999` or `?size=Infinity` → decodeKnob returns `{ value: 99999 }` / `Infinity`, and KnobSync writes
  it to the trial's config as is. The same value restored from a stored trial is clamped into 0–10 by labkit's
  `repairedConfig` (labkit/src/state/hydrate.ts:46). So one question gets two answers. The enum case already refuses
  an option the leaf doesn't list, but a number is never checked against `annotations.min`/`max` (or `endless` for
  ±Infinity). Nested numbers in `holds` aren't checked either.
- evidence: read
- severity: medium

## runStory themes the story host from the toolbar globals and ignores the story's own `globals`
- where: packages/forge/src/test/runStory.tsx:128 (the `StoryGlobalsContext` value), via shell/StoryTrial.tsx → shell/TrialHost.tsx:73
- scenario: a CSF story `export const Dark = { globals: { mode: 'dark' } }` run with `runStory(mod, 'Dark', …)` →
  the render context sees `mode: 'dark'`, because csfContext merges `story.globals`. TrialHost builds the host's
  globals from `StoryGlobalsContext` plus pins only and passes them to `useHostConditions` / `setup.applyGlobals`,
  so the host takes the toolbar's mode (here none, so light). The frame path (frame/storySession.tsx:119,137) applies
  `{ ...toolbar, ...story.globals }` to the document. A story test and the workshop frame therefore render the same
  story under different themes, which contradicts runStory's doc ("the way the workshop does"). Any color or axe
  check in `check` then tests the wrong mode.
- evidence: read
- severity: medium

## sameKnob treats Infinity, -Infinity, NaN and null as the same value
- where: packages/forge/src/route/url.ts:237 (sameKnob); used by knobsToParams:258, RouteKnobs.tsx:48, csf/argsToSchema.ts:307 (`eq`/`neq`)
- scenario: `stableStringify` writes all four as `null`, and `Object.is` only catches identical values. Take a leaf
  `f.number(Infinity).range(0, 100).endless('never', 'both')` set to `-Infinity`: knobsToParams treats the value as
  its default and writes no param, so the link drops the setting. On reload KnobSync compares -Infinity with the
  default Infinity, finds them "same", and leaves the stale value in place. An argType `if: { arg: 'x', eq: null }`
  likewise holds when x is NaN or ±Infinity.
- evidence: read
- severity: low

## withUnsent restores a list's left-behind fields by index, so deleting an entry moves another entry's callbacks onto it
- where: packages/forge/src/csf/portSafe.ts:114-115 (withUnsent, array branch); applied in csf/loadCsfModule.tsx:184
- scenario: arg `items: [{ label: 'A', onClick: fnA }, { label: 'B', onClick: fnB }]` gets a JSON control holding
  `[{label:'A'},{label:'B'}]`. The user deletes the first entry, so config becomes `[{label:'B'}]`. withUnsent pairs
  sent[0] with original[0] and gives the story `[{ label: 'B', onClick: fnA }]`: B's row now fires A's handler.
  Reordering entries does the same. An array of bare functions (sent as `[null, null]`) does it too: deleting the
  first entry yields `[fnA]`.
- evidence: read
- severity: low

## The URL drops every `$`-prefixed config key, but forge only owns `$globals` and the playhead key
- where: packages/forge/src/route/url.ts:21,54,226 (INTERNAL_PREFIX in isKnobParam / knobPaths)
- scenario: a CSF arg named `$tint` (any name is legal in Storybook) becomes a schema leaf and a working control,
  and `storyConfig` / `isForgePath` (shell/globals.ts:74-77) treat it as the story's. knobPaths and isKnobParam,
  however, refuse any key starting with `$` at any depth. Its value never reaches the URL, a shared link or an issue
  reopen link (`reopenLink`) loses it, and `?$tint=…` is ignored. The two places disagree about which keys forge owns.
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

<!-- done: 5 findings, files read: 29 -->
```

<!-- done: 5 findings, files read: 29 -->