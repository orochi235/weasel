# Audit round 56 — theme.engine findings

Note: the tree checked out here is HEAD a22801b42b (commit b8bed07d81 named in the brief is not in this
repository's object store); `git status` shows no local changes under `packages/theme/src/engine`.

## An offset rule with a fractional offset derives a reference to `<ramp>-undefined`, and derive throws
- where: packages/theme/src/engine/semantics.ts:172 (deriveOne, `from` branch) with packages/theme/src/engine/semantics.ts:294 (atStep) and packages/theme/src/engine/ruleShape.ts:35 (ruleProblem)
- scenario: `semantics: { hover: { from: 'accent', offset: 0.5, dir: 'darker' } }` where `accent` sits on ramp `brand` with steps `['100','500','900']` at index 1. `ruleProblem` accepts any finite `offset`. With offset 1.5, target 2.5 clamps to 2 and happens to work; with offset 0.5, target is 1.5, in range and unclamped. `atStep` checks only `index < 0 || index >= steps.length`, so index 1.5 passes and the token becomes `{brand-undefined}`. `checkReferences` then throws `Token "hover" references "brand-undefined", which is not defined`, so the whole derive (and bake, and the editor's mid-edit bake) throws on a shape mistake that should be an `invalid` issue. Should: reject a non-integer offset in `ruleProblem` (or `atStep` should require an integer index).
- evidence: read
- severity: medium

## A child's by-axis pin brings back the parent's pin at the axis values it leaves out, even on a step the child generates itself
- where: packages/theme/src/engine/merge.ts:42-47 (mergeChain) with packages/theme/src/engine/merge.ts:21 (fillFromParent)
- scenario: parent has `ramps.brand` with step `500` and `pins: { 'brand-500': '#000000' }`. Child redeclares `ramps.brand` (so `brand-500` is in `ownSteps(child)` and the parent's pin is dropped as shadowed). With no child pin, the child's `brand-500` at `mode: light` is its own generated color. Add a child pin `{ 'brand-500': { by: 'mode', dark: '#ffffff' } }`: `fillFromParent` is handed the parent's pin anyway (`getOwn(parentPins, name)` reads `parent.pins` unfiltered) and fills `light: '#000000'`, so at `light` the parent's pin now overrides the child's generated step. Adding a dark-only pin changed the light value. Should: fill from the parent only when the parent's pin is not shadowed (use the filtered `inherited` set).
- evidence: read
- severity: medium

## A gray anchor on a lightness ramp contributes a noise hue that the steps between it and a chromatic anchor blend toward
- where: packages/theme/src/engine/ramps.ts:46-61 (lightnessRamp, hueAndPeak)
- scenario: `anchor: { '100': '#ffffff', '900': '#1e3a8a' }`. `toLch('#ffffff')` gives C ≈ 1e-8 and H = `atan2` of rounding noise (paint's `oklabToOklch` does no powerless-hue handling), so `hueAndPeak` lerps hue between that arbitrary angle and the blue's ~264° along the shorter arc. The middle steps carry about half the blue's chroma at a hue far from blue (teal/green or purple depending on the noise sign), instead of a white-to-blue ramp staying blue. Should: treat an anchor whose chroma is ~0 as having no hue (take the neighboring anchor's hue, or `p.hue`), as CSS Color 4 does for powerless hues.
- evidence: read (`hexToOklchDeg` → `oklabToOklch` uses a bare `atan2`)
- severity: medium

## Equalizing chroma raises an anchor's chroma, though anchors are documented as only ever desaturated
- where: packages/theme/src/engine/color/generate.ts:122 (equalizeChroma)
- scenario: a categorical ramp with `gates: { equalize: 1 }` and a muted anchor `{ name: 'tan', hue: 70, lightness: 0.7, chroma: 0.04 }` beside vivid free hues (mean chroma ~0.15). `wanted = lerp(0.04, 0.15, 1) = 0.15`, and the anchor branch returns `toHex(L, Math.min(wanted, chromaCap(L, H)), H)`, so the tan comes back at chroma ~0.15, an amber — exactly what `Anchor.chroma`'s doc says a muted anchor exists to prevent, and contrary to the function's doc ("Anchors keep theirs and are only ever desaturated"). Should: clamp to `Math.min(wanted, x.C)` for anchors.
- evidence: read
- severity: medium

## `feasible` describes the palette before equalization, so the returned swatches can break the gates it vouches for
- where: packages/theme/src/engine/color/generate.ts:172-187 (generate)
- scenario: `searchHues` checks `minContrast`, `minSurfaceDistance`, `minDistance` and the hue floor on `place(h, c)` colors; `equalizeChroma` then moves free hues' lightness (to wherever the wanted chroma exists, anywhere in 0.30–0.96) and chroma. With `surface: '#181a1e'`, `minContrast: 4`, `equalize: 1`, a hue walked down toward L 0.30 to reach the mean chroma lands well under 4:1 on the dark surface, yet `feasible` stays true and `categoricalRamp` reports no `infeasible-ramp`. `stats.minContrast` then shows the violation the flag denies. Should: re-check the gates on the equalized hexes (or constrain the lightness walk by them) before reporting `feasible`.
- evidence: read
- severity: medium

## `order: 'hue'` sorts anchors by their raw hue, so an anchor given as -30° or 400° lands at the wrong place in the ring
- where: packages/theme/src/engine/color/generate.ts:181,192 (generate)
- scenario: `rampColors` accepts any finite anchor hue, and every color computation wraps it (toHex uses cos/sin, `seedRings` wraps with `wrapPositive`), but `hues` keeps `a.hue` unwrapped and the `'hue'` order sorts on it. An anchor at `hue: -30` (330°) sorts before a free hue at 10°, and one at `hue: 400` (40°) sorts after 350°, so the ramp's step order no longer follows the hue circle. Should: sort on `wrapPositive(hue, 360)` (or the swatch's measured hue).
- evidence: read
- severity: low

## A token that depends on two axes is declared only in blocks naming both, so setting one axis attribute leaves it at `:root`'s value
- where: packages/theme/src/engine/emit/css.ts:110-128 (blocks) and :201-213 (emitCss, default plan)
- scenario: the golden `packages/theme/src/engine/emit/e.tokens.css` shows it: `--wzl-pad-edge` depends on mode and density, so it is declared only under `[data-wzl-mode='light'][data-wzl-density='…']` (lines 53-61), never under `[data-wzl-mode='light']` alone. The default theme's unscoped selectors exist for pages that use `tokens.css` without `applyTheme`; a page with `<html data-wzl-mode="light">` and no density attribute (density at its default) gets `--wzl-surface` switched to paper but `--wzl-pad-edge` stays `:root`'s `var(--wzl-pad)` (4px) instead of light's `0px`. Same for any element setting only `data-wzl-density`: `--wzl-pad-edge` keeps the inherited, already-substituted value. Should: a multi-axis token's value at a combination whose other axes are default also needs to be reachable from the single-attribute selector (e.g. emit the default-valued axes as `:not([data-wzl-<axis>])` alternatives, or redeclare it in each single-axis block at the other axes' defaults).
- evidence: read (emitter and its golden output)
- severity: medium

## A token only a non-default theme declares is never reset, so a nested theme subtree inherits it from the outer theme
- where: packages/theme/src/engine/emit/css.ts:161-172,196-199 (emitCss: `redeclared`, `reset`, each plan's `names`)
- scenario: the comment says every theme redeclares whatever any non-default theme changes "so a subtree of one theme nested inside another resets instead of inheriting the outer theme's values". For a token `--wzl-brand-glow` that only theme `x` declares, the default's `reset` is filtered to `Object.keys(rootValues)` and every plan's `names` to the theme's own `resolved.names`, so neither the default nor a sibling theme `y` declares it. In `<div data-wzl-theme="x"><div data-wzl-theme="y">…`, `var(--wzl-brand-glow)` inside `y` still resolves to `x`'s value rather than being unset. Should: themes lacking a redeclared token declare it `initial` (or the guaranteed-invalid value) in their reset block.
- evidence: read
- severity: low

## The generated `themes.ts` fails to typecheck as soon as one theme or selection lacks a token another declares
- where: packages/theme/src/engine/emit/themes.ts:27-34,60-61,69,76 (emitThemes)
- scenario: `TokenName` is the union of every `--wzl-*` name over every theme and selection, and `GeneratedTheme.selections` is `Record<string, Readonly<Record<TokenName, string>>>`, checked with `satisfies`. A child theme that adds a token the default never declares (or a by-axis token present at only some selections, with no ancestor value at the others) makes the default's selection literals lack that key, and `tsc` reports "Property '--wzl-…' is missing" in the generated file. `generateTokens` raises no derive issue for this, so the build writes a file that breaks `npm run typecheck`. Should: type selections as `Partial<Record<TokenName, string>>`, or have `generateTokens` report the missing names.
- evidence: read
- severity: low

## `emitThemes` writes user-keyed records as JSON object literals, so a seed, axis value or theme named `__proto__` is lost in the generated module
- where: packages/theme/src/engine/emit/themes.ts:38,40,79,83 (emitThemes)
- scenario: `isSafeTokenName` refuses `__proto__` for token names and `axisNameProblem` for axis names, but nothing refuses it as an axis value or a seed name, and `derive` handles both through own-key reads. `emitThemes` then pastes `JSON.stringify(...)` output into TypeScript source; in an object literal a non-computed `"__proto__": {...}` sets the prototype instead of creating a key. So with `axes.mode.values.__proto__` the generated `axes:` in `THEMES` and `BAKED_THEMES` lacks that value, a baked token's `{ by: 'mode', __proto__: {...} }` branch becomes its prototype (`getOwn` then misses it), and `THEME_SOURCES` loses the seed; `tokens.css` meanwhile does emit `[data-wzl-mode='__proto__']`. Should: reject `__proto__` as an axis value and seed name in `derive` (as for tokens), or emit the data via `JSON.parse(<string literal>)`.
- evidence: read
- severity: low

## `derive` reads a dotted reference whole while every other reader strips its group, so `{color.accent}` throws in derive and resolves everywhere else
- where: packages/theme/src/engine/references.ts:5-11 (refName, used by checkReferences and inferTypes)
- scenario: `refTarget` (`dtcg/resolve.ts`) reads `{color.accent}` as `accent`, the DTCG `{type.name}` path `toDtcg` itself writes; `semantics.ts`, `deps.ts`, `emit/css.ts` and `resolveTokens` all use it. `references.ts` keeps its own `REF` and returns `color.accent`. A pin `'line': '{color.accent}'` (or a semantic `{ ref: 'color.accent' }`) therefore makes `checkReferences` throw `Token "line" references "color.accent", which is not defined`, though `deriveSemantics` follows it to `accent`, `axisDependencies` draws the edge to `accent`, and the runtime resolver would resolve it. Should: use `refTarget` in `references.ts`, so one definition of a reference holds.
- evidence: read
- severity: low

## An `away` offset rule's dependencies leave out the step it lands on, so a pin varying that step is missed
- where: packages/theme/src/engine/deps.ts:159-166 (axisDependencies, `from` leaf)
- scenario: `hover: { from: 'accent', offset: 2, dir: 'away' }` with `accent` on `gray-500` and a pin `'gray-700': { by: 'density', compact: '#444444', roomy: '#555555' }`. `hover`'s value is `{gray-700}`, but for `dir: 'away'` the edges are only `accent` and `ramps.gray`; the per-step edges are added only for `lighter`/`darker`, on the reasoning that only those read colors. The emitted value still references a step, so `hover.all` lacks `density`; `emitCss` declares `--wzl-hover: var(--wzl-gray-700)` only at `:root`, where the `var()` is substituted with the default density's gray-700, and `[data-wzl-density='roomy']` redeclares `--wzl-gray-700` but not `--wzl-hover`, which keeps the stale color (the trap `docs/traps/css-theme.md` describes). Should: add every step of the ramp as an edge for `away` too, as `contrast` does.
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

<!-- done: 12 findings, files read: 29 -->
