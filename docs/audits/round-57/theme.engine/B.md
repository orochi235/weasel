## theme.engine audit findings (round 57)

The findings file couldn't be written: the write to `.skulkr/out/findings.md` was refused for permissions. The whole document is below instead. All findings come from reading the code. I tried to confirm the first five by running them, but a node one-off was blocked by the shell's brace-and-quote check, so none of them were run.

## derive's reference check reads `{group.name}` references differently from semantics, deps and the emitter
- where: packages/theme/src/engine/references.ts:10 (refName), used by checkReferences and inferTypes
- scenario: a pin or component `'{color.brand-500}'` (the DTCG group-qualified form). `refTarget` (`dtcg/resolve.ts`, "the type group is dropped") resolves it to `brand-500`. semantics.ts (`color`, `positionAt`, `checkSemantics`), deps.ts and the emitters all use `refTarget`. `refName` keeps `color.brand-500`, so `checkReferences` throws "references "color.brand-500", which is not defined" and `derive`/`bake`/`generateTokens` abort. Before that throw, semantics has already measured the same pin's color without trouble. One question, what a reference names, gets two answers.
- evidence: read
- severity: medium

## An offset rule with a fractional `offset` mints `{ramp-undefined}` and makes derive throw
- where: packages/theme/src/engine/semantics.ts:172 (deriveOne, offset branch), :294 (atStep); packages/theme/src/engine/ruleShape.ts:34
- scenario: `{ from: 'accent', offset: 1.5, dir: 'away' }`. `ruleProblem` accepts any finite number. `target` is clamped but not rounded, and `atStep` checks only `index < 0 || index >= length`, so `steps[2.5]` is `undefined` and the token is `{brand-undefined}`. `checkReferences` then throws a "not defined" error instead of reporting an `invalid` issue. The fixture's `DOCUMENTED_THROW` regex matches that message, so the property tests would pass it as a documented throw.
- evidence: read
- severity: medium

## A `{seeds.name}` value resolves in components and pins but throws in a semantic `value` rule
- where: packages/theme/src/engine/semantics.ts:131 (deriveOne, value branch)
- scenario: `seeds: { brand: '#ff0000' }`. `components.c = '{seeds.brand}'` resolves through `pinValues.seeded`. `semantics.s = { value: '{seeds.brand}' }` keeps the literal. `refName` then reads it as a reference to `seeds.brand`, and `checkReferences` throws "not defined". `ThemeDefinition`'s doc says "Seeds feed the layers after them", and `axisDependencies` scans semantics for seed references and counts their axes, so deps treats the seed as resolved while derive throws on it.
- evidence: read
- severity: medium

## A white, black or gray anchor in a lightness ramp drags its arbitrary hue across the blended steps
- where: packages/theme/src/engine/ramps.ts:47-62 (lightnessRamp, anchors/hueAndPeak)
- scenario: `anchor: { '50': '#ffffff', '900': '#2563eb' }`. `toLch('#ffffff')` has C ≈ 0, and its H is `atan2` of rounding noise. `hueAndPeak` blends hue from that value toward blue along the shorter arc, so the middle steps pass through an unrelated hue (for example teal or green), at about half the blue's chroma. An achromatic anchor should take the hue of its neighboring anchor, or of `hue`, rather than its own.
- evidence: read (hue noise inferred from `oklabToOklch` = `atan2(B, A)` on near-zero a, b)
- severity: medium

## bake drops every token when any axis has no values yet
- where: packages/theme/src/engine/bake.ts:46 (table) and :95 (bakeOver)
- scenario: the editor adds axis `density: { values: {} }` mid-edit. `enumerateAxisChoices` returns `[]`, so `own` is empty, `produced` is empty, and the `selections.every(...)` skip makes the baked theme's `tokens` `{}`. The whole theme vanishes, and for a root theme nothing is left to fall through to. The `bake` doc says only branches derive could not produce are left out. `generateTokens` handles the same case on purpose ("An axis with no values leaves nothing to enumerate; one derive still reports the axis"); bake doesn't.
- evidence: read
- severity: low

## Categorical anchors' chroma, lightness and hue are never range-checked
- where: packages/theme/src/engine/entries.ts:163-172 (rampColors, categorical anchors); packages/theme/src/engine/color/placement.ts:35 (toHexPreview); packages/theme/src/engine/color/generate.ts:192
- scenario 1: `anchors: [{ name: 'brand', hue: 30, lightness: 0.6, chroma: -0.1 }]`. `Math.min(-0.1, cap)` passes a negative chroma to `toHex`, which emits the complementary hue (about 210°) with no issue raised. Lightness chroma params get "expected a number ≥ 0".
- scenario 2: `hue: 390` (or `-30`). `order: 'hue'` sorts on the raw anchor hue, so the swatch lands last instead of near 30°.
- evidence: read
- severity: low

## A lightness ramp anchor naming a step the ramp doesn't declare is dropped silently
- where: packages/theme/src/engine/ramps.ts:47 (lightnessRamp); packages/theme/src/engine/entries.ts:129
- scenario: `steps: ['100','500','900'], anchor: { '600': '#3366ff' }`, a typo or a step removed later. The anchor passes the hex check, is never matched against `p.steps`, and has no effect. No issue is reported, while every other malformed ramp parameter reports `invalid`.
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

<!-- done: 7 findings, files read: 29 -->