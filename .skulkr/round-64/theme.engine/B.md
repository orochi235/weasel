# Audit round 64, area theme.engine

Note: commit 49e5a07e6aecc7037a5e3692706cf28dd58211c4 is not in this clone's object store; the working tree (HEAD 6f634fabe1 plus uncommitted changes) was read as the frozen tree.

## Step names given as `{seeds.name}` are settled by derive but read raw everywhere else, so deps, merge and bake name tokens that do not exist
- where: packages/theme/src/engine/steps.ts:13-34 (alwaysDeclaredSteps, declaredSteps), read by packages/theme/src/engine/deps.ts:141-151 (axisDependencies), packages/theme/src/engine/merge.ts:12-17 (ownTokens), packages/theme/src/engine/bake.ts:59,121 (definitionOrder, ramps), packages/theme/src/engine/tokenSink.ts:38 (failEntry)
- scenario: `derive.ts:16` lists `steps` among the fields that take `{seeds.name}`, and `settle` resolves a step item `'{seeds.s}'` to the seed's value, so `ramps.gray = { kind: 'lightness', steps: ['{seeds.s}', '900'], hue: { by: 'mode', dark: 250, light: 30 }, ... }` with `seeds.s = '500'` derives `gray-500`. `declaredSteps`/`alwaysDeclaredSteps` take the raw strings, so `axisDependencies` has an entry for `gray-{seeds.s}` and none for `gray-500`. `emitCss` then finds no deps for `gray-500` (`all` = []), writes it only in `:root` at the default (dark) selection, and the light-mode blocks never redeclare it: light mode shows the dark color. With a by-axis seed (`s: { by: 'mode', dark: '500', light: '600' }`) `gray-600` exists only off the default selection and is never written to tokens.css at all. The same raw names make `mergeChain` fail to shadow a parent pin on `gray-500` (the parent pin overrides the child's own step), and `bake` records `'{seeds.s}'` as a step name in `ramps`. Should: either refuse a seed in `steps` (and drop it from PARAMS) or have every step reader see settled names.
- evidence: read
- severity: medium

## Semantic rules measure a pin or component that derive then rejects as malformed
- where: packages/theme/src/engine/pinValues.ts:35 (pinAt), used by packages/theme/src/engine/derive.ts:146-147 and packages/theme/src/engine/semantics.ts:84 (color)
- scenario: `pins: { 'gray-9': { value: '#000000', type: 5 } }` (or `description: 3`, or `alpha: 2`), with a semantic `{ ramp: 'gray', contrast: { min: 4.5, against: ['gray-9'] } }`. `pinToken` runs `pinProblem`, reports `invalid` and keeps the generated `gray-9`; but `pinAt`, which the semantic's `color` and `positionAt` read, never runs `pinProblem`, so the contrast rule picks its step against `#000000`, a color the final tokens do not have. Same for a component (`component` → `pinAt`, while `derive` drops that component as failed). With an invalid `alpha` the contrast rule instead fails "needs solid colors" although the final token is solid. The build refuses such a definition, but the editor derives and bakes mid-edit and shows these picks. Should: `pinAt` return undefined whenever `pinToken` would reject the value.
- evidence: read
- severity: low

## An `away` offset rule gets no dependency on the step it lands on
- where: packages/theme/src/engine/deps.ts:181-188 (axisDependencies)
- scenario: `semantics: { accent: { ramp: 'gray', step: '500' }, hover: { from: 'accent', offset: 1, dir: 'away' } }` with `pins: { 'gray-600': { by: 'density', compact: '#101010', roomy: '#202020' } }`. `hover` derives to `{gray-600}`, but for `dir: 'away'` the leaf adds only `accent` and `ramps.gray`, never the step tokens (only `lighter`/`darker` add them), and `accent` reaches `gray-500`, not `gray-600`. So `hover`'s `all` lacks `density`, and `emitCss` declares `--wzl-hover: var(--wzl-gray-600)` only where its other axes vary; a theme applied to a subtree with a non-default density inherits `hover` computed against the outer density's `gray-600`. A `step` rule adds the step it names, so the two rules disagree on whether the step a rule ends on is a dependency. Should: add every declared step of each ramp the `from` can sit on for `away` too, as `lighter`/`darker` already do.
- evidence: read
- severity: low

## A semantic's color follows a component, but its ramp position does not
- where: packages/theme/src/engine/semantics.ts:98-108 (positionAt) against semantics.ts:84 (color); same gap in packages/theme/src/engine/deps.ts:155-175 (rampsOf)
- scenario: `components: { chip: '{gray-500}' }`, `semantics: { chipRef: { ref: 'chip' }, chipHover: { from: 'chipRef', offset: 1, dir: 'darker' } }`. `color` resolves `{chip}` through `ctx.component`, so a contrast rule against `chipRef` measures `gray-500`; `positionAt('chip')` checks ramp steps, pins and semantics only, so `chipHover` is reported "`chipRef` does not end on a ramp step" though its final value is `{gray-500}`. The same definition with `chip` as a pin instead of a component works. Should: `positionAt` follow a component's reference as it follows a pin's (and `rampsOf` likewise).
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
