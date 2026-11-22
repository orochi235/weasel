# Audit round 71 — theme.engine findings

## A child's step-layer entry declared at only some selections replaces an inherited step everywhere, while the same partial entry against an inherited semantic replaces nothing
- where: packages/theme/src/engine/merge.ts:70-82 (foldChain, `childNames` / `stepTokens`) vs packages/theme/src/engine/merge.ts:12-18,65-69 (`ownTokens` / `shadowed`)
- scenario: `replaced` is built from `stepTokens`, which uses `declaredSteps` (any selection), while `shadowed` uses `alwaysDeclaredSteps` (every selection). Two cases:
  (1) Parent has ramp `brand` with steps `['x']` and semantic `accent: { ramp: 'brand', step: 'x' }`. Child extends it and adds scale `brand` with `steps: { by: 'mode', dark: ['x'], light: ['z'] }`. `childNames('ramps')` holds `brand-x`, so `replaced.ramps` gets `brand-x` and the parent ramp's step goes unproduced at **every** selection. At `mode: light` nothing produces `brand-x`, it is not in `failed`, and `checkReferences` throws `Token "accent" references "brand-x", which is not defined`. Expected: the inherited step shows through where the child declares nothing.
  (2) Parent has semantic `brand-x`. Child adds a ramp `brand` with the same partial steps. `alwaysDeclaredSteps` gives `[]`, so the parent semantic is not shadowed and is kept at every selection. At `dark` the sink reports `"brand-x" is already produced by ramps.brand`, an `invalid` issue that makes `generateTokens` refuse the set.
  The same question ("does a child's partially declared name replace an inherited one?") gets opposite answers: removed at every selection in one case, kept at every selection in the other. Neither replaces it only where the child declares it.
- evidence: read
- severity: medium

## An offset rule's `from` cannot name a ramp step or a component, though `axisDependencies` treats both as valid
- where: packages/theme/src/engine/semantics.ts:110 (positionOf) and :161-163 (deriveOne `from`); packages/theme/src/engine/deps.ts:164-176,191-197 (rampsOf)
- scenario: `positionOf` returns undefined for any name that is not a semantic rule, so `{ from: 'blue-500', offset: 2, dir: 'darker' }` is reported as `"blue-500" does not end on a ramp step`, even though `positionAt('blue-500')` returns `{ ramp: 'blue', index }`. The same happens for a component `chip: '{blue-500}'`. A `from` naming a missing name (`from: 'typo'`) gets the same `invalid` message rather than the "not defined" throw that a dangling `ref` or `against` gets. Meanwhile `axisDependencies` resolves `rampsOf(leaf.from)` through `stepRamps` and components, so it treats these as producing a step. The OffsetRule doc says "from wherever `from` lands on its ramp", which a ramp step plainly does. Expected: either `from` accepts anything `positionAt` resolves, or deps and the docs say it is semantics-only and a dangling name is reported as one.
- evidence: read
- severity: low

## `summarize` returns ±Infinity spreads and minimums for an empty palette
- where: packages/theme/src/engine/color/paletteStats.ts:27-32 (summarize)
- scenario: A categorical ramp with `steps: []` (which `stepsProblem` accepts) calls `generate({ count: 0 })`, giving zero swatches. `meanChroma` guards the empty case (`cs.length || 1`), but `chromaSpread` and `lightnessSpread` come out as `-Infinity - Infinity = -Infinity`, and `minContrast` and `minSurfaceDistance` as `Infinity`. `minHueGap` and `hueFloorShare` fall back to 360 and 1. Expected: the empty case is handled the same way across every stat (0, or the same neutral fallbacks the others use).
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
