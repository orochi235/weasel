# Audit round 81 — ui.components.Badge

## The stylesheet adds a shape's insets to the `padding` prop, where the prop's doc, `ownPadding` and docs/unruled.md (2026-11-20) say the prop replaces them
- where: packages/ui/src/components/Badge/Badge.module.css:90-96 (`--_pad-*`), :127-130 (plain), vs packages/ui/src/components/Badge/Badge.tsx:35-36 and useInsets.ts:26-40 (`ownPadding`)
- scenario: `<Badge shape="shield" padding={2}>` (any shape with insets). `paddingStyle` sets `--badge-pad-top: 2px`, and the CSS computes `--_pad-top: calc(var(--badge-pad-top, …) + var(--badge-inset-top))`, so the badge is padded 2px + inset, not 2px. Commit 6304d44ee9 (21:29) made the CSS add; 1799fd980d (22:53, same day) ruled the opposite in unruled.md line 3512 and wrote `ownPadding` to that ruling, so the two halves disagree. Should: a side given `--badge-pad-<side>` is padded by it alone.
- evidence: read (plus `git log` of both commits)
- severity: medium

## On a fitted base (Quatrefoil, Puzzle, OctantSpline, OctantBSpline) with a `padding` prop, the inset fit can flip between two values forever
- where: packages/ui/src/components/Badge/useInsets.ts:26-40 (`ownPadding`), :70-77 and :121-135 (`useInsets` fit)
- scenario: follows from the finding above. On a side with `--badge-pad-<side>` set, `ownPadding` takes the computed padding whole as own padding, but the computed padding is P + I (the CSS also adds the inset I). With declared insets D that do not clear the outline: render 1, I = D → pad = P+D → fit F → fitted = F−P−D. Render 2, I = F−P−D → pad = F−D → floor = D + F−D = F, which already clears → `all === floor` → null → back to declared D. Render 3 equals render 1. Each step comes from a layout effect's setState, so the badge re-renders and resizes on every commit, never settling (and at best ends at the wrong padding). Should: measured padding and the padding the CSS applies use one rule.
- evidence: read (traced by hand; not run)
- severity: medium

## A `padding` of one `var()` (or a non-shorthand) skips the insets entirely, yet `ownPadding` still subtracts the inset, so the fit under-reads the badge's padding
- where: packages/ui/src/components/Badge/paddingSides.ts:28 (`paddingStyle`, `return { padding }`), useInsets.ts:31-32 (`ownPadding`)
- scenario: `<Badge base="quatrefoil" padding="var(--my-pad)">`. The inline `padding` beats the class's `padding: var(--_pad-top) …`, so the computed padding holds no inset. No `--badge-pad-*` is set, so `ownPadding` subtracts `--badge-inset-*` from it anyway, reading padding too small (clamped at 0). The fitted insets it computes are then written to `--badge-inset-*`, which nothing applies. Also the pill/plain label hit area (`.target` padding from `--_pad-*`) is sized from the size's padding, not the one shown. Should: either set the per-side properties for the lone-var case or have `ownPadding` not subtract an inset on sides a plain `padding` covers.
- evidence: read
- severity: low

## A removable button-label's keyboard activation bypasses `labelProps.onClick` and its `preventDefault` veto
- where: packages/ui/src/components/Badge/BadgeLabel.tsx:66-76 (`BadgeTarget`, role="button" branch)
- scenario: `<Badge onClick={go} onRemove={rm} labelProps={{ onClick: (e) => e.preventDefault() }}>`. A mouse click runs `shared.onClick`, which calls `extra.onClick` and skips `go` when prevented. Enter or Space instead calls `onClick?.()` directly: `extra.onClick` never runs and `go` fires anyway. A native `<button>` (the non-split path) dispatches a click for both keys, so the two paths answer differently. Should: route Enter/Space through `shared.onClick` (or dispatch a click).
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

<!-- done: 4 findings, files read: 23 -->
