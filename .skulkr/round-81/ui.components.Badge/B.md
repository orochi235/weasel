# Audit round 81 — ui.components.Badge

## The padding prop both adds to and replaces the shape's insets: CSS adds them, `ownPadding` and the prop's doc assume replacement, so a fitted base double-counts the inset
- where: packages/ui/src/components/Badge/useInsets.ts:30 (ownPadding); packages/ui/src/components/Badge/Badge.module.css:84 (`--_pad-*` rules); packages/ui/src/components/Badge/Badge.tsx:34 (`padding` doc)
- scenario: the stylesheet computes each side as `calc(var(--badge-pad-<side>, …) + var(--badge-inset-<side>, 0px))`, so insets add to a given padding (commit 6304d44ee9, asserted by Badge.props.test.tsx:85). `ownPadding` was later changed (1799fd980d) to treat a side with `--badge-pad-<side>` as "padded by that alone" and so subtracts no inset there; `BadgeOwnProps.padding`'s doc says the prop "replaces both the size's padding and the shape's insets". `docs/unruled.md` holds both rulings (lines 3396 and 3512, same day). Consequence on a fitted base (`<Badge base="rounded-rect" baseParams={{erosion: 0.8}} padding={4}>`): measured own pad = 4 + inset, so the floor is declared + 4 + inset and the fit returns `all − (4 + inset)`; once applied, the real padding is 4 + fitted, the next measurement (the every-render layout effect) reads a different pad, and the fit can flip between `declared` and `T − 4 − d` each render (when the needed clearance T exceeds 2·declared + 4) — a layout-effect update loop / flicker, and in the `declared` phase the label sits inside the outline. Should: pick one ruling and make the CSS, `ownPadding`, and the doc agree.
- evidence: read (CSS, useInsets, test files, unruled.md, git show of both commits); the oscillation is inferred from the code, not run
- severity: high

## Keyboard activation of a split label skips `labelProps.onClick`, which a mouse click runs and can veto
- where: packages/ui/src/components/Badge/BadgeLabel.tsx:66 (BadgeTarget, `role="button"` branch)
- scenario: `<Badge onClick={go} onRemove={rm} labelProps={{ onClick: (e) => e.preventDefault() }}>` — a mouse click runs `extra.onClick` and then `go` only if not defaultPrevented; Enter/Space call `onClick?.()` directly, so `labelProps.onClick` never runs and cannot cancel the action. A native button fires `click` on Enter/Space, so the caller's handler would see both. Should route keyboard activation through the same `shared.onClick` path (or dispatch a click).
- evidence: read
- severity: medium

## A lone-`var()` padding (prop or `style.padding`) silently drops any per-side padding given alongside it
- where: packages/ui/src/components/Badge/paddingSides.ts:27 (paddingStyle), :56 (liftPadding)
- scenario: `<Badge style={{ padding: 'var(--p)', paddingLeft: 2 }}>` or `<Badge padding="var(--p)" style={{ paddingTop: 0 }}>` → `padding: var(--p)` is set inline while the side goes to `--badge-pad-left` / `--badge-pad-top`; the inline shorthand overrides the stylesheet's `padding: var(--_pad-top) …`, which is the only reader of those properties, so the side value has no effect (and the shape's insets vanish on every side). Should: when the shorthand falls back to plain `padding`, emit the longhands as plain `paddingLeft`/… too.
- evidence: read
- severity: low

## An out-of-registry `base` prop discards the shape's own composition and draws nothing
- where: packages/ui/src/components/Badge/composeSpec.ts:26 (resolveCompose)
- scenario: `<Badge shape="square" base={nameFromPicker}>` where the runtime string is not in `BASES` (the case `registryEntry` exists to guard): `spec` is skipped because `own.base` is truthy, `registryEntry` returns null, so `base` is null; BadgeDeco then falls to the shape path, and `square` (compose-only, no `Component`) renders no outline at all, while `data-shape` reads `square`. Should fall back to the shape's own compose when the given base is unknown, as an unknown `shape` falls back to pill.
- evidence: read
- severity: low

## Catalog lookups throw on a name outside the registry, where every other lookup in the area tolerates one
- where: packages/ui/src/components/Badge/catalog.ts:17 (badgeShapeDefaults), :22, :27, :38, :48
- scenario: the registries are null-prototype tables (`registryTable`), so `badgeShapeDefaults('bogus')` / `badgeEffectZone(name)` with a runtime string reads `undefined.defaults` and throws a TypeError, while Badge, BadgeDeco, composeSpec and effectParams all go through `registryEntry` and fall back. Same question (unknown key) answered two ways.
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
packages/ui/src/components/Badge/registryEntry.ts
packages/ui/src/components/Badge/registryTable.ts
packages/ui/src/components/Badge/types.ts
packages/ui/src/components/Badge/useCrawlPhase.ts
packages/ui/src/components/Badge/useInsets.ts
packages/ui/src/components/Badge/useSvgBox.ts
packages/ui/src/components/Badge/variantIcons.ts

<!-- done: 5 findings, files read: 23 -->
