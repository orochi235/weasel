I couldn't finish the findings file: the first write went through, but permission to append was refused. `.skulkr/out/findings.md` holds only the first three findings, with no "Files read" section and no done line. The full document follows.

# Audit round 61: ui.components.Badge

## A `padding` prop drops the shape's insets, while useInsets fits as if insets were added on top of it
- where: packages/ui/src/components/Badge/Badge.module.css:89-95 (`--_pad-*`), packages/ui/src/components/Badge/useInsets.ts:26-36 (ownPadding), packages/ui/src/components/Badge/paddingSides.ts:25 (paddingStyle)
- scenario: `<Badge shape="starburst" padding={4}>NEW</Badge>` (any shape that declares insets, or `base="powerline"` inside a Powerline, given `padding`).
  - `paddingStyle` sets `--badge-pad-*`. The stylesheet's `--_pad-top: var(--badge-pad-top, calc(pad-y + --badge-inset-top))` then uses that property as the whole padding.
  - So `--badge-inset-*`, the shape's declared and fitted insets, never reach layout.
  - Meanwhile `ownPadding` assumes the computed padding is `own + inset` and subtracts the inset var, clamped at 0. `fitMoved` then grows an inset that the stylesheet discards.
  - "Does the badge's padding add to its insets?" is answered yes by useInsets and no by the stylesheet.
- evidence: read. The story's argType (Badge.stories.tsx:35) calls `padding` "Padding in place of the shape's own", which suggests replacing the insets is deliberate. If so, the remaining defect is narrower: the `padding` prop in Badge.tsx has no doc saying this, and useInsets still fits (with `ownPadding` measuring wrong) for a padding that throws the result away.
- severity: low

## A badge's measured own padding goes stale when only its padding changes
- where: packages/ui/src/components/Badge/useInsets.ts:38-58 (useMeasured)
- scenario: a fitted badge (one on a `fitsContent` base) changes `padding` from 2 to 12, or changes its `style` padding, without its label changing.
  - `ownPadding` is read only in the layout effect (deps `[ref, enabled]`) and in the content span's resize callback.
  - The content span's size does not change when the root's padding does, so `measured.pad` keeps the old value.
  - The returned insets are fitted for the old padding.
- evidence: read
- severity: low

## Focusing the remove control rings a removable plain badge, but not a removable badge with an action
- where: packages/ui/src/components/Badge/Badge.tsx:190-191 (commonProps.onFocus/onBlur)
- scenario: `<Badge onRemove={f}>tag</Badge>` has a span root and `split` is false.
  - Tabbing to the × fires React's bubbling `onFocus` on the root. The root gets `data-focused="true"` and draws the focus ring.
  - With `onClick` added (`split` true), the root ignores focus. Badge.test.tsx:241 holds that the root is marked focused for "the click target …, not the remove control".
  - The two paths answer the same question differently.
- evidence: read
- severity: low

## An effect or base param set to `undefined` replaces its default, the bug shapes were just fixed for
- where: packages/ui/src/components/Badge/composeOutline.ts:30 (displacer), packages/ui/src/components/Badge/BadgeDeco.tsx:41 (render), packages/ui/src/components/Badge/composeSpec.ts:31 (resolveCompose)
- scenario: `effects={[{ type: 'spikes', params: { count: undefined } }]}`, the kind of value a picker produces when a control is cleared.
  - The `{ ...defaults, ...params }` spread keeps `count: undefined`.
  - `Math.max(3, Math.floor(undefined))` is NaN, so the outline path is all NaN.
  - `baseParams={{ chamfer: undefined }}` fails the same way through resolveCompose.
  - Commit 25561f07cf moved shapes to `withDefaults` (Badge.tsx:157), so these three merges disagree with how shapes merge.
- evidence: read
- severity: medium

## types.ts says `square` is drawn in CSS; it is composed from the rounded-rect base
- where: packages/ui/src/components/Badge/types.ts:4 (BadgeShape doc)
- scenario: the doc says "`pill`, `plain` and `square` are drawn in CSS", but:
  - `shapes/Square.tsx` composes `{ base: 'rounded-rect' }` and has no `renderMode: 'css'`.
  - `badgeShapeRendering('square')` (catalog.ts:37) returns `'composed'`.
  - Its root's `data-shape` is `compose`.
- evidence: read
- severity: low

## A `padding` given as one `var()` holding a shorthand is copied onto every side and breaks
- where: packages/ui/src/components/Badge/paddingSides.ts:25-35 (paddingStyle)
- scenario: `padding="var(--chip-pad)"` with `--chip-pad: 2px 8px`.
  - `tokens` sees one token, so every `--badge-pad-<side>` gets `2px 8px`.
  - The `padding: var(--_pad-top) …` declaration (Badge.module.css:94) then has eight values and is invalid at computed-value time, so the badge has zero padding.
  - Before 8c0d99c1c7 this worked. paddingStyle could set a lone `var()` as plain `padding`, as it already does for other values it cannot split.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Badge/Badge.module.css
packages/ui/src/components/Badge/Badge.stories.module.css
packages/ui/src/components/Badge/Badge.stories.tsx
packages/ui/src/components/Badge/Badge.tsx
packages/ui/src/components/Badge/BadgeDeco.tsx
packages/ui/src/components/Badge/BadgeLabel.tsx
packages/ui/src/components/Badge/BadgeRoot.tsx
packages/ui/src/components/Badge/badgeRoles.ts
packages/ui/src/components/Badge/catalog.ts
packages/ui/src/components/Badge/composeOutline.ts
packages/ui/src/components/Badge/composeSpec.ts
packages/ui/src/components/Badge/geometry.ts
packages/ui/src/components/Badge/index.ts
packages/ui/src/components/Badge/looks.ts
packages/ui/src/components/Badge/paddingSides.ts
packages/ui/src/components/Badge/powerlineProps.ts
packages/ui/src/components/Badge/registryTable.ts
packages/ui/src/components/Badge/types.ts
packages/ui/src/components/Badge/useCrawlPhase.ts
packages/ui/src/components/Badge/useInsets.ts
packages/ui/src/components/Badge/useSvgBox.ts
packages/ui/src/components/Badge/variantIcons.ts

<!-- done: 6 findings, files read: 22 -->