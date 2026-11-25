I couldn't write `.skulkr/out/findings.md` because the write permission was declined, so the whole document is below, as the brief allows. The commit `deaf03bd…` isn't in this repository, so line numbers refer to the working tree at `6f634fabe1`. None of the area's files have uncommitted changes there.

# Audit round 60 — theme.engine

## A pin's or component's `description` (and `alpha`, `type`) is never type-checked, and a non-string description crashes `emitCss`
- where: packages/theme/src/engine/pinValues.ts:38 (pinToken); crash at packages/theme/src/engine/emit/css.ts:191 (emitCss)
- scenario: a theme JSON has `pins: { surface: { value: '#ffffff', type: 'color', description: 5 } }` (or the same under `components`).
  - `ruleShape.ts:25` reports a semantic whose `description` isn't a string, but `pinToken` copies `obj.description` straight into the token, and `derive` reports nothing.
  - So `generateTokens` finds no problems, bakes, and `emitCss` throws `TypeError: token.description.replaceAll is not a function` while writing `:root`. It should report an `invalid` issue, as it does for semantics.
  - `alpha` behaves the same way: `ruleShape.ts:31` reports a semantic `ref` with a non-number alpha, but a pin `{ value: '{gray-500}', alpha: 'half' }` passes and is written as `color-mix(in srgb, var(--wzl-gray-500) NaN%, transparent)`.
- evidence: read
- severity: medium

## `equalize` changes a muted anchor's chroma upward, which its doc says never happens
- where: packages/theme/src/engine/color/generate.ts:123 (equalizeChroma)
- scenario: a palette with `equalize: 1` and an anchor `{ name: 'tan', hue: 70, lightness: 0.7, chroma: 0.05 }` among vivid free hues.
  - `wanted = lerp(x.C, mean, k)` is above the anchor's 0.05. The anchored branch clamps only to the gamut cap (`Math.min(wanted, chromaCap)`), so the tan is raised to the set's mean chroma and comes back amber.
  - The doc says anchors "are only ever desaturated", and `Anchor.chroma`'s doc explains the tan-to-amber case is exactly why chroma is given.
  - It should clamp to `min(wanted, x.C)`.
- evidence: read
- severity: medium

## `generate` reports `feasible: true` for a palette that equalizing pushed outside the gates
- where: packages/theme/src/engine/color/generate.ts:174–189 (generate); reported through packages/theme/src/engine/ramps.ts:102 and entries.ts:177
- scenario: a categorical ramp with `gates: { equalize: 1, minContrast: 4.5 }` (`equalize` is an accepted gate).
  - `searchHues` checks contrast, surface distance and pairwise distance on the colors `place` gives.
  - `equalizeChroma` then moves non-anchor swatches to a different lightness where the target chroma exists, which changes their contrast and distances. Nothing checks them again.
  - `feasible` stays true and `derive` reports no `infeasible-ramp`, while `stats.minContrast` (measured after equalizing) can be below 4.5.
- evidence: read
- severity: medium

## A child's own by-axis pin is filled from a parent pin that the child's own ramp shadows
- where: packages/theme/src/engine/merge.ts:42–46 (mergeChain / fillFromParent)
- scenario: the parent declares ramp `gray` with step `500` and pins `gray-500: '#123456'`. The child redefines ramp `gray` and pins `gray-500: { by: 'mode', dark: '#000000' }`.
  - `ownSteps` marks `gray-500` as shadowed, so the parent's pin is dropped from `inherited`, which means the child generates that step itself.
  - But `fillFromParent` still takes `getOwn(parentPins, 'gray-500')` and fills `light` with `#123456`.
  - At `mode=light` the child shows the parent's pinned color instead of its own generated `gray-500`. The shadowing rule gets two answers depending on whether the child also pins the name.
- evidence: read
- severity: low

## An inherited pin silently overrides a semantic the child redefines, while ramp and scale steps the child redefines drop the parent's pin
- where: packages/theme/src/engine/merge.ts:11–18 (ownSteps), :42–43 (mergeChain)
- scenario: the parent has `semantics: { accent: { ramp: 'blue', step: '500' } }` and `pins: { accent: '#ff0000' }`. The child redefines `semantics.accent: { ramp: 'green', step: '500' }`.
  - Only ramp and scale steps count as shadowed, so the parent's pin is inherited and overrides the child's rule at every selection.
  - `bake` then finds the child's `accent` equal to the parent's and leaves it out. The child's redefinition has no effect and nothing is reported.
  - A ramp step the child redefines gets the opposite answer: the parent's pin is dropped so the child "generates rather than inherits pinned".
- evidence: read
- severity: low

## `axisDependencies` keeps the last producer of a duplicated name; `derive` keeps the first
- where: packages/theme/src/engine/deps.ts:122, :129, :177, :182 (axisDependencies) vs packages/theme/src/engine/tokenSink.ts:27–31 (put)
- scenario: ramp `text` with step `muted`, its `lightness` set `by: 'mode'`, and a semantic `text-muted: { value: '#000000', type: 'color' }`.
  - `derive` puts the ramp step first and reports the semantic as already produced, so `text-muted` varies on `mode`.
  - `axisDependencies` sets `nodes['text-muted']` from the ramp, overwrites it with the semantic's node at :177, and reports `own: [], all: []`.
  - The same happens for ramp against scale and semantic against component. The theme editor calls this mid-edit, so it shows the wrong axes for the token derive actually gives.
- evidence: read
- severity: low

## `generate` returns more swatches than `count` when there are more anchors than `count`
- where: packages/theme/src/engine/color/generate.ts:177–188 (generate)
- scenario: `generate({ ...DEFAULT_CONSTRAINTS, count: 3, anchors: [a1, a2, a3, a4, a5] })`.
  - `searchHues` returns null because `freeCount < 0`, and `free` is `[]`.
  - `hues` then holds all 5 anchors, so the palette has 5 swatches. The function's doc promises "a categorical palette of `count` swatches", and a "full palette" when infeasible.
  - `categoricalRamp` keeps only the first `steps.length` swatches in display order, so which anchors survive depends on `order`.
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