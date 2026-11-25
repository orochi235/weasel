# Audit round 73 — theme.engine findings

## axisDependencies settles an inherited step's producer even where a descendant's step replaces it at some selections, dropping the replacing entry's axes
- where: packages/theme/src/engine/deps.ts:155 (axisDependencies, ramps loop; same at :162 for scales)
- scenario: parent declares ramp `blue` with steps `['500']`; child (extends parent) declares a scale `blue` whose `steps` is `{ by: 'mode', dark: ['500'], light: [] }`. `foldChain` without a selection only replaces steps declared at *every* selection, so `replaced.ramps` lacks `blue-500`, and the ramps loop calls `produce('blue-500', rampNode, always=true)`, settling it; the scale loop's `produce` is then skipped. But `derive` at `mode=dark` (foldChain with that selection) replaces the ramp step and the scale produces `blue-500`, at light the ramp does. The token varies on `mode`, yet `axisDependencies` reports `own`/`all` = `[]`, so `emitCss` treats it as invariant, writes it only in `:root`/the invariant blocks at the default selection, and `[data-wzl-mode='…']` blocks never carry it. `always` should be false for names in `partly` (as the pins loop already does with `partly.has(name)`).
- evidence: read (merge.ts fold: `shadowed` from `read.always`, `partly` from `read.any`; deps.ts `producer` settles on `always`)
- severity: medium

## A categorical ramp's duplicate anchor whose name is no step is reported as filling that step already
- where: packages/theme/src/engine/entries.ts:169 (rampColors, categorical anchor-name check)
- scenario: `anchors: [{ name: 'brand', … }, { name: 'brand', … }]` on a ramp whose steps don't include `brand`. The first is reported "no step "brand" on this ramp", then `named.add('brand')`; the second hits `named.has` first and is reported "an earlier anchor already fills step "brand"", which no anchor does — the step doesn't exist. The check should only count names that actually filled a step (`steps.includes`) in `named`, or test the missing step first.
- evidence: read
- severity: low

## emitThemes writes an unparseable `TokenName` when no theme has a token
- where: packages/theme/src/engine/emit/themes.ts:84 (emitThemes)
- scenario: definitions whose every selection resolves to no tokens (e.g. a root theme with only axes): `names` is empty, so the source reads `export type TokenName =\n;` — a TypeScript syntax error in the generated `themes.ts`. Should emit `never` when the set is empty.
- evidence: read
- severity: low

## generateTokens accepts two definitions with the same name and emits both under one selector
- where: packages/theme/src/engine/emit/tokens.ts:18 (generateTokens)
- scenario: two definitions named `x` (one extending the root): `byName` keeps the last, so `lookup('x')` and `emitCss`'s `chainOf` resolve every `extends: 'x'` to the last one, while both are baked and emitted — two `[data-wzl-theme='x']` block sets in `tokens.css` (later wins by source order) and a duplicate `"x"` key in `THEMES` / `BAKED_THEMES` in `themes.ts`. The first definition's tokens are silently shadowed instead of the set being refused as a problem.
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
