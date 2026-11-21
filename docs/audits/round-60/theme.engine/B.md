I couldn't write `.skulkr/out/findings.md` because the write needed approval that wasn't granted, so the whole document is below. One caveat: commit `deaf03bd…` isn't in this repo. `HEAD` is `6f634fabe1`, and the files under `packages/theme/src/engine` have uncommitted changes. I read the files as they sit on disk.

# Audit round 60: theme.engine findings

## A parent's pin overrides a child's own semantic or component of the same name
- where: packages/theme/src/engine/merge.ts:42-47 (mergeChain, ownSteps)
- scenario: The parent pins `accent: '#ff0000'`. A child extends it and defines its own `semantics.accent: { ramp: 'blue', step: '500' }`, or `components.accent`. `ownSteps` shadows parent pins only for the ramp and scale steps the child declares, so the parent's `accent` pin is kept in `out.pins`. `derive` then puts the child's semantic and `applyPins` writes the parent's `#ff0000` over it. The child's own rule never shows at any selection. It should behave as the ramp case does: the child generates the token itself, so the parent's pin on it is dropped. The child's definition should win, as the docstring says ("child entries winning").
- evidence: read (merge.test.ts covers shadowing for ramp steps only)
- severity: medium

## derive throws a TypeError on an axis loaded as null instead of reporting it
- where: packages/theme/src/engine/axisIssues.ts:8 (axisIssues)
- scenario: A definition loaded from a file has `axes: { mode: null }`, or any non-object axis entry such as `[null]`. `derive` calls `axisIssues(def.axes)`, which reads `def.values` on `null` and throws `Cannot read properties of null`. `fullAxisChoice` (axes.ts:51) would throw the same way. The ruled behavior (unruled.md 2026-11-11, "axes loaded malformed are reported, and the rest derives") requires an `invalid` issue at `axes.mode` instead. The malformed property test never generates this case, because its axis entries always come from `near({...})` objects.
- evidence: read
- severity: medium

## Pins and components are not shape-checked, though a semantic rule with the same fields is
- where: packages/theme/src/engine/pinValues.ts:30-38 (pinToken)
- scenario: A pin `{ value: '{accent}', alpha: 'half' }`, `{ value: '{accent}', alpha: 50 }`, `{ value: '#fff', type: 5 }`, or `{ value: { r: 1 } }` becomes a token with that field copied in unchanged, and no issue is reported. `cssValue`/`mixAlpha` then writes `color-mix(... NaN% ...)` or `5000%`, and a non-string type or an object value reaches the emitters. The same fields on a semantic rule go through `ruleProblem` (`alpha must be a number`, `type must be a string`, `value must be a string, a number, or a list of those`). One question ("is this field readable?") gets two answers depending on the layer. Expected: an `invalid` issue, and no token or the field dropped.
- evidence: read
- severity: low

## `{seeds.x}` inside a pin or component list is never resolved; inside a semantic `value` it is
- where: packages/theme/src/engine/pinValues.ts:14-20 (seeded), against packages/theme/src/engine/entries.ts:26-63 (settle), used by semantics.ts:131
- scenario: Seed `font: 'Inter'`. A semantic `{ value: ['{seeds.font}', 'sans-serif'] }` derives to `['Inter', 'sans-serif']`, because `settle` replaces seeds at any depth. A component or pin with the same value `['{seeds.font}', 'sans-serif']` keeps the literal string `{seeds.font}`, which reaches the CSS as a font name, and no issue is reported. `axisDependencies` (`scan`) still counts the seed as a dependency of the pin. Both paths should resolve seeds the same way, or the pin path should report the seed reference it cannot resolve.
- evidence: read
- severity: low

## emitThemes writes user-keyed records as object literals, so an axis value or theme named `__proto__` is lost
- where: packages/theme/src/engine/emit/themes.ts:38-40, 79, 83 (emitThemes)
- scenario: An axis value named `__proto__` is not refused: `axisNameProblem` checks axis names only, and `pick`/`fullAxisChoice` read it by own key. A theme name `__proto__` is not refused either. `JSON.stringify` correctly writes the value as `"__proto__": {...}`. But emitThemes pastes that JSON into `themes.ts` as a JavaScript object literal, and in a literal a `"__proto__"` key sets the prototype instead of creating a property. The generated module therefore loses the key in several places: `THEMES` (the theme), `axes.values`, every `by` branch in `BAKED_THEMES`/`THEME_SOURCES` keyed by that value, and the `${JSON.stringify(baked.name)}: {` entry. At runtime, `pick` then reports a missing axis value for a selection the build accepted. Expected: refuse the name, or emit computed keys (`["__proto__"]`) or `JSON.parse` of the text.
- evidence: read
- severity: low

## The hue search can return hue 360, which `order: 'hue'` sorts last instead of first
- where: packages/theme/src/engine/color/hueSearch.ts:154 and 163 (seedRings)
- scenario: A seed hue is computed as `Math.round(wrapPositive(x, 360))` or `Math.round(x % 360)`. For x in [359.5, 360) this gives 360. One way to get there: one anchor at hue 46 with count 7, so minGapDeg = 46.29, divisor 5, i = 5, jitter 0 → 359.71 → 360. If that seed is kept and `descend` never moves the slot, `searchHues` returns 360. `generate` then sorts `hues` numerically under `order: 'hue'`, so the swatch at 0°/360° comes last rather than first, and the ramp's step order no longer follows hue. Expected: wrap after rounding.
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

<!-- done: 6 findings, files read: 29 -->