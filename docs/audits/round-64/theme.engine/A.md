# Audit round 64 — theme.engine findings

## Generated `themes.ts` fails to typecheck whenever any theme or selection lacks a token another one has
- where: packages/theme/src/engine/emit/themes.ts:35-38, 64-65, 73, 80 (emitThemes)
- scenario: `TokenName` is the union of every `--wzl-*` name across every theme and every selection, and each
  selection object is checked by `satisfies Record<string, GeneratedTheme>`, whose `selections` are
  `Readonly<Record<TokenName, string>>`, so every key in the union is required. But each selection body is just
  `resolveTokens(tokensAt(chain, sel))`, which holds only what that theme has at that selection. A child theme whose
  pin adds a token the root lacks (`pins: { 'brand-x': '#ff0000' }`; definition.ts says a pin "replaces the token of its name,
  or adds one"), or a ramp whose `steps` vary `by` mode (one mode has `gray-950`, the other doesn't), derives with
  no issue, so `generateTokens` returns `ok: true`. The emitted `THEMES` literal then has a selection missing a
  required `TokenName` key, and `satisfies` fails to compile (TS1360, property missing). Expected: either every
  selection holds every name, or the selection type allows a partial record.
- evidence: read (the TypeScript error is inferred from how `satisfies` checks required keys; emit.test.ts only
  regex-matches the text and never compiles it)
- severity: medium

## A pin over a component drops the component's `scope` but keeps its type and description
- where: packages/theme/src/engine/pinValues.ts:55 (pinToken)
- scenario: the token falls back to `prior` for `type` and `description`, but takes `scope` from the pin only.
  A component `tb: { value: '#111111', type: 'color', scope: ['density'] }` pinned with `pins: { tb: '#222222' }`
  (or a child theme's pin over a parent's component) comes out with `type: 'color'`, the component's description,
  and no scope. Its pref is then no longer scoped by `density`. `scope` is metadata about the token, the same as
  `type` and `description`, not something tied to the value the way `alpha` is, so it should fall back to
  `prior?.scope` too.
- evidence: read
- severity: low

## Duplicate step names are accepted and produce a ramp that collides with itself
- where: packages/theme/src/engine/entries.ts:110-111 (stepNames); packages/theme/src/engine/derive.ts:46-57, 88-90 (settleEntry, putRamps)
- scenario: `steps: ['50', '50', '900']` passes `stepNames` and every check in `settleEntry`. For a lightness ramp,
  `lightnessRamp` spaces lightness over n = 3, writes `out['50']` twice (the second write, at t = 0.5, wins), and
  `putRamps` puts `gray-50` twice, so the second put reports `"gray-50" is already produced by ramps.gray`: the
  ramp blamed for colliding with itself. For a categorical ramp, `generate` makes 3 swatches and one is silently
  overwritten. Meanwhile `steps.ts` (`stepList`, `declaredSteps`) dedupes the same list, so merge, bake and deps
  see two steps while derive lays out three. Expected: reject a repeated step name in `settleEntry` with an
  `invalid` issue naming it, as it already does for `by` and for unsafe names.
- evidence: read
- severity: low

## A `ref` semantic looks its target up for its type even when the target is pinned, so a cycle the pin breaks still throws
- where: packages/theme/src/engine/semantics.ts:137 (deriveOne, `ref` branch)
- scenario: `semantics: { a: { ref: 'b' }, b: { ref: 'a' } }, pins: { a: '#ffffff' }`. The final tokens are
  `a = #ffffff` and `b = {a}`, which has no cycle (`checkReferences` would accept it), and `positionAt` checks the pin
  before the rule, as the context's doc ("Rules that measure color read final colors") asks. But the type lookup
  `env.get(r.ref)` runs unconditionally: `get(a)` → `get(b)` → `get(a)` hits `inProgress` and `derive` throws
  `Semantic cycle at "a"`. Expected: consult `ctx.pinned(r.ref)` (its `type`) before `env.get`, or leave the type
  to `inferTypes`, which already types refs from their final chain.
- evidence: read
- severity: low

## `axisDependencies` lists step tokens that `derive` rejects and never produces
- where: packages/theme/src/engine/deps.ts:142-151 (axisDependencies); packages/theme/src/engine/steps.ts:18-34 (declaredSteps)
- scenario: the docstring says it maps "Every token of the definition that `derive` gives" (commit e441f69b2d made that
  the contract). But step names come from `declaredSteps`, which keeps any string, while `derive`'s `settleEntry`
  refuses a step named `by` or one that `isSafeTokenName` rejects (`'a b'`, `'x.y'`), and with it the whole entry.
  A ramp `gray` with `steps: ['50', 'by']` produces no tokens in `derive`, but `axisDependencies` returns entries
  for `gray-50` and `gray-by`. The same applies to scales. Expected: filter the steps that `settleEntry` filters.
- evidence: read
- severity: low

## A categorical ramp's anchor `name` is required and validated, then dropped; nothing ties an anchor to a step
- where: packages/theme/src/engine/entries.ts:164-173 (rampColors, categorical); packages/theme/src/engine/ramps.ts:97-101 (categoricalRamp)
- scenario: `rampColors` fails the ramp unless each anchor has a string `name`, but `categoricalRamp` maps swatches to
  steps by their index in `generate`'s output order, which the `order` gate decides (`farthest` by default: the
  first anchor first, the rest wherever the farthest-first walk places them; `hue`: by hue). Swatch names never
  reach a token. So with `steps: ['brand', 'a', 'b']` and `anchors: [{ name: 'brand', ... }, { name: 'warn', ... }]`,
  under `order: 'hue'` the `brand` anchor can land on step `b`. The author has no way to pin an anchor to a step,
  and the required `name` has no effect on the output. Expected: an anchor fills the step it names (or the step at
  its index), or `name` is not required.
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
