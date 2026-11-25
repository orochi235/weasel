# Audit round 67 — theme.engine

## Duplicate categorical anchor names: which anchor fills the named step follows palette order, not definition order, contradicting the reported issue
- where: packages/theme/src/engine/color/generate.ts:199 (generate → uniqueNames); packages/theme/src/engine/entries.ts:175 (rampColors); packages/theme/src/engine/ramps.ts:103 (categoricalRamp)
- scenario: a categorical ramp with gates `{ order: 'hue' }` and anchors `[{ name: 'brand', hue: 200, … }, { name: 'brand', hue: 30, … }]`. `rampColors` reports anchor 1: "an earlier anchor already fills step "brand"; it fills a step no anchor names". But `generate` calls `uniqueNames` over the swatches in output order (`order.map(...)`), which for `order: 'hue'` puts the hue-30 anchor first, so anchor 1 claims `brand` and anchor 0 becomes `brand-2` and goes into `rest`. Step `brand` gets anchor 1's color while the issue says anchor 0's. Relatedly, the renamed duplicate (`brand-2`) fills a step literally named `brand-2` if the ramp has one, not "a step no anchor names". Names should be claimed in anchor (definition) order, as the issue text states.
- evidence: read
- severity: low

## A pin over a semantic that failed at this selection is never reported untyped
- where: packages/theme/src/engine/references.ts:83 (inferTypes); packages/theme/src/engine/derive.ts:149,114 (derive, applyPins)
- scenario: a semantic fails at a selection (e.g. a `by` missing that value), so `derive` adds its name to `failed`; a pin of that name with an untyped literal (`'#ff0000'`, no `type`) then applies (no `prior`), producing a token of type `unknown`. `applyPins` never removes the name from `failed`, so `inferTypes` skips it ("a name whose production failed was reported then") and no `untyped-pin` issue is raised, although the pin's production succeeded and the token goes out typed `unknown`. The skip should test whether a token was produced, not whether some earlier layer failed.
- evidence: read
- severity: low

## axisDependencies ignores a component that derive uses wherever a same-named `by` semantic has no value
- where: packages/theme/src/engine/deps.ts:201,206 (axisDependencies, producer)
- scenario: semantics `x: { by: 'mode', dark: { ref: 'a' } }` and component `x: { by: 'density', … }`. At mode=light the semantic misses, `derive` adds `x` to `failed` without calling `sink.put`, so the component's `sink.put('x', …)` succeeds and `x` takes the component's density-varying value there. `axisDependencies` calls `produce(name, n, true)` for every semantic, settling `x`, so the component's node is dropped and `x`'s deps omit `density`; emitCss then writes no density blocks for it. (Only reachable with a missing-axis-value issue, i.e. mid-edit or in bake, which the editor runs on definitions with issues.)
- evidence: read
- severity: low

## fillFromParent fills only the top-level axis a child pin leaves out, not nested ones
- where: packages/theme/src/engine/merge.ts:21 (fillFromParent)
- scenario: parent pin `p: { by: 'mode', dark: { by: 'density', compact: A, roomy: B }, light: C }`; child pin `p: { by: 'mode', dark: { by: 'density', compact: X } }`. The merge fills `light` from the parent but leaves `dark` as the child's, so at mode=dark, density=roomy the pin has no value: with no rule under it `derive` reports `missing-axis-value` for `pins.p` (and bake leaves the branch out), where the parent's `B` should have shown through as it does for the left-out `light`. The doc says the axis values the child leaves out come from the parent; nested ones are left out too.
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
