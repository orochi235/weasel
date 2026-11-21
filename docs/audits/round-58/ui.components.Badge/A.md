# Audit round 58 — ui.components.Badge (reviewer B)

Note: the frozen commit b400d7039e is not in this clone; the tree read is the working tree at HEAD a22801b42b
with its uncommitted changes (Badge.tsx and shapes/params.ts among them).

## `as="span"` with `onClick` silently drops the click handler on an unsplit badge
- where: packages/ui/src/components/Badge/BadgeRoot.tsx:31 (BadgeRoot, span branch); packages/ui/src/components/Badge/Badge.tsx:124 (onClick destructured out of domProps)
- scenario: `<Badge as="span" onClick={f}>x</Badge>` (e.g. a badge nested inside another button, where the docs say "override with `as`"). `onClick` is pulled out of `domProps`, and BadgeRoot's span branch renders `<span {...rootProps}>` without it, so clicking does nothing. The same props plus `onRemove` and `tooltip` (split path) do call `onClick` via BadgeTarget's `shared.onClick`, so the option is honored on one path and dropped on the other.
- evidence: read
- severity: medium

## Base and effect params merge with a plain spread, so an `undefined` value overrides its default — unlike shape params
- where: packages/ui/src/components/Badge/composeSpec.ts:30 (resolveCompose); packages/ui/src/components/Badge/BadgeDeco.tsx:40 (render); packages/ui/src/components/Badge/composeOutline.ts:30 (displacer)
- scenario: shape params go through `withDefaults`, whose rule is "a key set to `undefined` keeps its default". Base params (`{ ...base.defaults, ...given }`) and effect params (`{ ...mod.defaults, ...eff.params }`) don't follow it. A controlled caller passing `baseParams={{ radius: state.radius }}` or `effects={[{ type: 'spikes', params: { count: maybe } }]}` with an unset value gets `undefined` in place of the default, so the base or effect computes NaN geometry (an empty or broken path), where the same pattern on `shapeParams` falls back to the default. The same question is answered two ways in three places.
- evidence: read
- severity: medium

## The `padding` prop replaces the shape's insets, and useInsets then miscounts the badge's own padding
- where: packages/ui/src/components/Badge/Badge.module.css:90-93 (`--_pad-*`); packages/ui/src/components/Badge/useInsets.ts:26 (ownPadding)
- scenario: `--_pad-top: var(--badge-pad-top, calc(pad-y + inset-top))`, so when `padding` (or `style.padding`) is set, `--badge-inset-*` drops out of the padding entirely. `<Badge shape="shield" padding={4}>` gets 4px on every side and loses Shield's declared `bottom: 14` inset, so the label runs into the point. For a `fitsContent` base, `ownPadding` assumes the inset is still added in and returns `max(0, P − inset)`. The fitted insets it computes only reach the CSS variable, which the padding never reads, so the fit has no effect. Either the insets should add to the `padding` prop, or ownPadding should not subtract an inset that isn't in the padding. As written the two disagree.
- evidence: read
- severity: medium

## Fitted insets go stale when only the badge's padding changes
- where: packages/ui/src/components/Badge/useInsets.ts:38-56 (useMeasured)
- scenario: `pad` (from `ownPadding`) is read only on mount and when the content span resizes. Changing the `padding` prop or `style.padding` on a `fitsContent` base (e.g. a lab slider) changes the root's padding but not the content span's size. ResizeObserver doesn't fire and the effect deps `[ref, enabled]` don't change, so `measured.pad` keeps the old value. `fitted` subtracts the stale pad: growing the padding from 4 to 12 over-pads by the difference, and shrinking it lets the content cross the outline. This holds until something else resizes the label.
- evidence: read
- severity: low

## Focus ring shows on an unsplit removable badge when only its remove button is focused, but not on a split one
- where: packages/ui/src/components/Badge/Badge.tsx:179-180 (commonProps onFocus/onBlur)
- scenario: `<Badge onRemove={f}>x</Badge>` (plain span, no tooltip, so `split` is false). Tabbing to the × bubbles React `onFocus` to the root, `!split` holds, `focused` becomes true, and the whole badge draws its focus ring (`data-focused` outline, or the SVG `badge-focus` path) around the badge as well as the ×. With `onClick` added, the badge becomes split, and focusing the same × draws no badge ring: only the label sets `focused`. So the same control gets two different focus treatments depending on whether the label has an action.
- evidence: read
- severity: low

## Crawl phase leaves 0..1 for a negative `crawl`
- where: packages/ui/src/components/Badge/useCrawlPhase.ts:13
- scenario: `crawl={-0.3}` (reverse crawl; the type accepts any number). `(p + negative) % 1` keeps JS's sign, so the phase runs in (−1, 0], against the hook's documented 0..1 range. Shapes and effects that take `phase` as a 0..1 fraction (e.g. indexing a pattern or offsets assumed non-negative) get negative values. The repo's `wrapPositive`, which this area already uses in composeOutline, is the fix.
- evidence: read
- severity: low

## Unknown `shape` keys resolve through the prototype chain
- where: packages/ui/src/components/Badge/Badge.tsx:142-143
- scenario: the `?? SHAPES.pill` fallback exists for runtime values outside `BadgeShape` (a URL param, a saved config, a picker). `shape="constructor"` or `"toString"` finds `Object.prototype` members, which are truthy. `shapeModule` becomes a function with no `defaults`/`insets`/`Component`, `data-shape="constructor"` is emitted, and no pill styling applies, instead of falling back to pill. The same applies to `BASES[key]` in composeSpec.ts:26 and to `EFFECTS[eff.type]` lookups (filtered there by `.Component`/`.offsetAt`, so harmless).
- evidence: read
- severity: low
