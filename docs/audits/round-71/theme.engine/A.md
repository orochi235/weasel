# Audit round 71 — theme.engine findings

## A child's ramp or scale step declared at only some selections does not shadow the parent's semantic, component or pin of that name, so the child is reported as a duplicate (and loses to a parent pin)
- where: packages/theme/src/engine/merge.ts:12 (ownTokens), :65-69 and :83-87 (foldChain)
- scenario: parent declares semantic `r-b`; child declares ramp `r` with `steps: { by: mode, dark: ['a','b'], light: ['a'] }`. `ownTokens` uses `alwaysDeclaredSteps`, so `r-b` is not in `shadowed` and the parent's semantic stays in the merged definition. At `mode=dark`, `derive` puts the ramp step first and then `sink.put` of the inherited semantic pushes `invalid: "r-b" is already produced by ramps.r`, so `generateTokens` refuses a definition where the child entry should simply win ("a child's entry wins in any layer"). Same for an inherited pin of that name: it is not shadowed either, so it overrides the child's own ramp step at every selection where the child declares it. The reverse direction (child semantic over a parent ramp step) is handled through `replaced`, which uses `declaredSteps`, so the two directions answer the question differently.
- evidence: read
- severity: medium

## A single neutral anchor on a lightness ramp silently drops the declared `chroma.peak`, turning the whole ramp gray
- where: packages/theme/src/engine/ramps.ts:56-71 (lightnessRamp, hueAndPeak)
- scenario: `{ kind: 'lightness', hue: 250, chroma: { peak: 0.15 }, anchor: { '50': '#ffffff' } }`. The neutral anchor's hue is replaced by `p.hue` (it "has no hue of its own"), but its peak ~0 is kept, and with one anchor every step takes that anchor's peak (`next === -1` → last anchor). Every unanchored step gets chroma 0: a gray ramp, with the declared `peak` ignored and nothing reported. A neutral's chroma says as little about the ramp's color as its hue does; it should fall back to `p.peak` (or the nearest chromatic anchor's) the way its hue does.
- evidence: read
- severity: medium

## A duplicate categorical anchor can take the step a later anchor names, so that later anchor fills no named step and is not reported
- where: packages/theme/src/engine/color/generate.ts:200 (generate, uniqueNames over anchors) with packages/theme/src/engine/ramps.ts:103 (categoricalRamp) and packages/theme/src/engine/entries.ts:174-181
- scenario: steps `['a','a-2','c']`, anchors named `a`, `a`, `a-2`. `uniqueNames` claims `a`, then `a-2` for the second anchor, then `a-2-2` for the third. `categoricalRamp` puts the second (duplicate) anchor's color on step `a-2`, and the third anchor, which really names `a-2`, goes to `rest` and fills `c`. `rampColors` reports only anchor 1 ("an earlier anchor already fills step a; it fills a step no anchor names") — false, it fills `a-2`, which anchor 2 names — and reports nothing for anchor 2, whose named step went to someone else. The ruling (unruled.md, 2026-11-21) is that a duplicate fills a step no anchor names.
- evidence: read
- severity: low

## A contrast rule on a one-step ramp always fails with "cannot tell which end is darker"
- where: packages/theme/src/engine/semantics.ts:154-159 (darkening), :188-189 (contrast branch)
- scenario: ramp `brand` with `steps: ['500']`, semantic `{ ramp: 'brand', contrast: { min: 3, against: ['surface'] } }`. `darkening` compares the first and last step, which are the same step, so `first === last` and the rule is reported `invalid` and produces no token, even when that only step passes the minimum. The direction is not needed to pick among one step. The same happens for any ramp whose two end steps resolve to the same OKLCH lightness (e.g. both ends pinned to one color).
- evidence: read
- severity: low

## `summarize` of an empty palette returns ±Infinity stats, unlike its own small-set defaults
- where: packages/theme/src/engine/color/paletteStats.ts:27-32 (summarize)
- scenario: `generate({ ...DEFAULT_CONSTRAINTS, count: 0 })` (the lab's count slider at 0, or a categorical ramp with `steps: []`, which `stepsProblem` accepts). `chromaSpread` and `lightnessSpread` become `maxOf([]) - minOf([])` = `-Infinity`, and `minContrast` and `minSurfaceDistance` become `Infinity`, while `minHueGap`, `hueFloorShare` and `minDistance` explicitly default to 360 / 1 / 1 for fewer than two swatches. A readout then shows `-Infinity`; the empty set is answered two ways in one function.
- evidence: read
- severity: low

## `axisDependencies` treats a pin as always applying when a seed inside its value list has no value, while `derive` lets the rule underneath show through
- where: packages/theme/src/engine/deps.ts:66-72 (pinApplies) vs packages/theme/src/engine/pinValues.ts:17-32 (seeded)
- scenario: semantic `x` varying by `mode`, pin `x: { value: ['{seeds.a}', 'b'] }` with seed `a: { by: density, compact: 1 }`. At `density=roomy`, `seeded` cannot resolve the list item, `pinToken` returns undefined and `applyPins` keeps the semantic's token (which depends on `mode`). `pinApplies` reads only a whole-value seed reference, so it says the pin applies at every selection, drops the semantic's dependencies, and reports `x` as depending on nothing; the CSS emitter would then put `x` in the invariant block instead of the mode blocks. The question "does this pin replace the rule here" is answered two ways. (`seedsAt` also reports the unresolved seed, so the build refuses it; this bites in the editor.)
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
