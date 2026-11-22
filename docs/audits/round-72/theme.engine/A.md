# Audit round 72 — theme.engine findings

## bake drops every token that does not vary on an axis whose default is missing, not a string, or not one of its values
- where: packages/theme/src/engine/bake.ts:104 (bakeOver → build)
- scenario: a definition with `axes.density = { values: { compact: {}, roomy: {} }, default: 'cozy' }` (or `default` deleted / a number, as the editor holds it mid-edit). `table()` keys each derived selection by `axisChoiceKey(axes, sel)` with `sel` from `enumerateAxisChoices`, so the keys read `density=compact` / `density=roomy`. A token that does not vary on density is built with `at(fullAxisChoice(axes, sel), name)` where `sel` lacks density; `fullAxisChoice` fills density with `'cozy'` (or leaves it out, giving `density=undefined`), the key matches nothing in `own`, `at` returns undefined, and the token is omitted from `BakedTheme.tokens`. With such an axis, every token that does not branch on it vanishes from the bake. `derive` at each enumerated selection produces them fine and only reports the axis issue; the header says "definitions with issues still bake, because the editor bakes mid-edit", and the 2026-11-11 ruling only says a `by` on such an axis reports a missing value, not that unrelated tokens disappear. Should read the leaf at a real selection (e.g. complete `sel` from the enumerated selection rather than from the default).
- evidence: read (bake.ts:44-53, 82-85, 103-104; axes.ts fullAxisChoice/axisChoiceKey)
- severity: medium

## toDtcg's "same leaf in every mode" test compares tokens by reference, so a baked theme never qualifies
- where: packages/theme/src/engine/emit/dtcg.ts:123 (toDtcg)
- scenario: a baked token varying on mode at `density=compact` only. `bake` nests it `{ by: 'mode', dark: { by: 'density', … roomy: X1 }, light: { by: 'density', … roomy: X2 } }`, where X1 and X2 are distinct objects with equal contents (each selection's tokens are normalized separately in `table()`, and BAKED_THEMES comes from JSON). For the `roomy` override layer, `p.value === first.value` is false, so the value is written into every mode group instead of once into `primitives`, contrary to the comment's intent ("this combination doesn't depend on mode"). The export is bloated and a plain DTCG reader sees a mode-dependent token where there is none. Compare by value (`deepEqual`), as bake's `same` does.
- evidence: read (dtcg.ts:120-127; bake.ts:44-53, 103-116)
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

<!-- done: 2 findings, files read: 29 -->
