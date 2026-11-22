# Audit round 67 — theme.engine

## A child theme's entry loses to a parent's entry of the same token name in another layer
- where: packages/theme/src/engine/merge.ts:41 (mergeChain), with packages/theme/src/engine/derive.ts:135-156 and packages/theme/src/engine/tokenSink.ts:27-32
- scenario: the parent declares ramp `blue` with steps `['500']`, and the child declares semantic `blue-500: { value: '#ff0000', type: 'color' }` (or a parent component `tb` that the child redefines as a semantic `tb`). `mergeChain` merges layer by layer, so the merged definition holds both the parent's ramp and the child's semantic. `derive` puts ramps before semantics, `sink.put` keeps the first producer, and it reports the child's semantic as `invalid` ("already produced by ramps.blue"). The parent's `#…` ramp color ships, and `generateTokens` refuses the set. In the component case the child's semantic wins only because semantics run before components, and the parent's component is still reported. `mergeChain` promises "child entries winning", and `ownTokens` does shadow parent *pins* by name, but it shadows nothing in another layer. A child should be able to replace a parent token of that name from any layer, with the parent's entry in the other layer dropped.
- evidence: read
- severity: medium

## An element stamping only `data-wzl-theme` inherits an outer theme's axis-varying tokens
- where: packages/theme/src/engine/emit/css.ts:203 (emitCss `reset`), :231 (`invariant`), :30 (axisSets skips the empty set)
- scenario: default theme `e` and theme `x`, with `surface` varying by `mode`. An element `[data-wzl-theme='e']` with no axis attributes, nested inside `[data-wzl-theme='x'][data-wzl-mode='light']`. The `[data-wzl-theme='e']` block redeclares only tokens with no axis dependencies (`all.length === 0`), and `axisSets` starts at mask 1, so no block for the empty axis set exists. `surface` therefore inherits `x`'s light value and does not reset to `e`'s default-mode value. The same holds for the `invariant`-only block of a non-default theme. This contradicts the stylesheet's own rule for partial stamps (unruled.md 2026-11-21: left-out axes read at their defaults). `applyTheme` stamps every axis, so only a hand-stamped or SSR-stamped theme attribute hits it.
- evidence: read
- severity: low

## `bake` lists ramps whose names `derive` drops as unsafe
- where: packages/theme/src/engine/bake.ts:121 (bakeOver `ramps`)
- scenario: a definition (the editor bakes mid-edit) with ramp `"a.b"` or `"__proto__"`. `derive` runs `withoutUnsafeNames`, reports the name and produces no tokens for it. But `bakeOver` builds `ramps` from the raw `definition.ramps`, so `BakedTheme.ramps` still holds `"a.b": [...]`, and `toDtcg` writes it under `com.weasel.ramps`. A reader of `ramps` then expects step tokens `a.b-500` that no theme has. The ramps should be filtered the way the tokens are.
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

<!-- done: 3 findings, files read: 29 -->
