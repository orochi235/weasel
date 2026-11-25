# Audit round 72: theme.engine — findings

## axisIssues accepts an axis value named "by", which no `by` can ever select
- where: packages/theme/src/engine/axisIssues.ts:14 (axisIssues)
- scenario: `axes: { mode: { default: 'dark', values: { dark: {}, by: {} } } }` (or `default: 'by'`). axisIssues reports nothing, `enumerateAxisChoices` yields a `mode=by` selection, but `pick` (axes.ts:115) refuses the value `'by'` because a `by` object's `by` key holds the axis name, so a branch for it can never be written. Every `by: 'mode'` token at that selection reports `missing-axis-value` (axis mode, value by) — the author is told to add a branch that cannot exist, and the axis value itself, the actual problem, is never named. `stepsProblem` (steps.ts:15) already rejects `"by"` as a step name for the same reason; axis values get no such check. Should: report `axes.mode.values.by` as invalid.
- evidence: read
- severity: medium

## Axis value entries are never checked to be objects, so a `null` value passes derive and crashes emitCss; a `scheme` string is written into CSS verbatim
- where: packages/theme/src/engine/axisIssues.ts:14 (axisIssues); packages/theme/src/engine/emit/css.ts:41 (checkSchemes), :126/:148/:211
- scenario: `axes: { mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: null } } }`. axisIssues only checks that `values` has keys and holds the default, so `derive` reports no issue and `generateTokens` passes its problems gate, then `emitCss` → `checkSchemes` evaluates `null.scheme` and throws a TypeError (same in `axisScheme`, axes.ts:91). Likewise `scheme: 'dark; } body { display: none'` or a non-string scheme is never checked and is emitted as `color-scheme: ${scheme};` unescaped, breaking or injecting into the stylesheet. Should: axisIssues reports a value entry that is not an object, or whose `scheme` is not a valid color-scheme string.
- evidence: read
- severity: medium

## A child that changes a seed its inherited ramp's `steps` name gets new step tokens, but its baked `ramps` keeps the parent's step list
- where: packages/theme/src/engine/bake.ts:121 (bakeOver)
- scenario: parent declares `ramps.gray: { kind: 'lightness', steps: ['{seeds.a}', '{seeds.b}'], … }` with `seeds: { a: '100', b: '900' }`; child extends it and sets only `seeds: { a: '050', b: '950' }`. `derive` of the child (merged seeds) produces `gray-050`/`gray-950`, and bake writes them as the child's tokens, but `ramps` is built only from `definition.ramps` (the child's own), so the child's BakedTheme has no `gray` entry and `findRampSteps` (colorListItems.ts:66) answers the parent's `['100','900']` for the child: step lookups (`rampSteps`, color lists) name steps the child's selection doesn't hold in its own layer, and miss the child's. Same for a child that adds an axis value an inherited ramp's `by`-varying `steps` reads. Should: write a `ramps` entry for every ramp whose `declaredSteps` under `merged` differ from the parent's.
- evidence: read
- severity: low

## Across `extends`, a child's ramp (or scale) step loses to an inherited entry of the same layer that produces the same token name, though a child wins in every other layer
- where: packages/theme/src/engine/merge.ts:95-107 (fold, `childNames`), :86
- scenario: parent `ramps: { 'blue-dark': { steps: ['1','2'], … } }`, child `ramps: { blue: { steps: ['dark-1','dark-2'], … } }`. Both produce `blue-dark-1`. `childNames(layer)` deliberately excludes the child's own layer, so the inherited `blue-dark` steps are not put in `replaced.ramps`; the layer spread `{ ...parent.ramps, ...def.ramps }` puts the parent's key first, so in `derive` (`putRamps` → `TokenSink.put`, first producer wins) the inherited step wins and the child's is reported "already produced by ramps.blue-dark". A child semantic, component or scale step of that name would instead replace the inherited ramp step (`foldChain`'s doc: "a child's entry wins in any layer"). Should: treat a child's step from a differently named entry of the same layer like one from another layer.
- evidence: read
- severity: low

## Files read
packages/theme/src/engine/axisIssues.ts
packages/theme/src/engine/bake.ts
packages/theme/src/engine/color/generate.ts
packages/theme/src/engine/color/hueNames.ts
packages/theme/src/engine/color/hueSearch.ts
packages/theme/src/engine/color/oklch.ts
packages/theme/src/engine/color/paletteStats.ts
packages/theme/src/engine/color/placement.ts
packages/theme/src/engine/definition.fixture.ts
packages/theme/src/engine/deps.ts
packages/theme/src/engine/derive.ts
packages/theme/src/engine/emit/css.ts
packages/theme/src/engine/emit/dtcg.ts
packages/theme/src/engine/emit/e.tokens.css
packages/theme/src/engine/emit/manifest.ts
packages/theme/src/engine/emit/themes.ts
packages/theme/src/engine/emit/tokens.ts
packages/theme/src/engine/entries.ts
packages/theme/src/engine/merge.ts
packages/theme/src/engine/pinValues.ts
packages/theme/src/engine/ramps.ts
packages/theme/src/engine/references.ts
packages/theme/src/engine/ruleShape.ts
packages/theme/src/engine/safeNames.ts
packages/theme/src/engine/scales.ts
packages/theme/src/engine/semantics.ts
packages/theme/src/engine/steps.ts
packages/theme/src/engine/tokenSink.ts
packages/theme/src/engine/types.ts

<!-- done: 4 findings, files read: 29 -->
