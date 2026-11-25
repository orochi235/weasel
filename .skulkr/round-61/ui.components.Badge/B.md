## A base or effect param explicitly set to `undefined` replaces its default and draws NaN geometry
- where: packages/ui/src/components/Badge/composeSpec.ts:31 (resolveCompose); packages/ui/src/components/Badge/composeOutline.ts:30 (displacer); packages/ui/src/components/Badge/BadgeDeco.tsx:41 (BadgeDeco render)
- scenario: `<Badge base="chamfered-rect" baseParams={{ chamfer: undefined }}>` or `effects={[{ type: 'puffs', params: { bumpWidth: undefined } }]}` (both typed as allowed by the optional params). The merges are `{ ...defaults, ...given }`, so the key's `undefined` overwrites the default; ChamferedRect's build then takes `Math.min(undefined, …)` = NaN and Puffs' `Math.max(6, undefined)` = NaN, so the body path and decoration are NaN and nothing draws. Shapes were fixed for exactly this on 2026-11-20 (25561f07cf, `withDefaults` in shapes/params.ts, used in Badge.tsx:157), so the same question — does an `undefined` key keep its default — is answered two ways: yes for `shapeParams`, no for `baseParams` and effect `params`. Should merge through `withDefaults` in all three places.
- evidence: read
- severity: medium

## `labelProps.className` and `labelProps['aria-label']` are silently overwritten on a removable badge's label
- where: packages/ui/src/components/Badge/BadgeLabel.tsx:43-46 (BadgeTarget, `shared`)
- scenario: `<Badge onClick={f} onRemove={g} labelProps={{ className: 'mine', 'aria-label': 'Open' }}>x</Badge>` → `shared` spreads `...extra` and then sets `className: s.target` and `'aria-label': props['aria-label']`, so the label gets only `s.target` (caller's class dropped) and `aria-label` becomes `undefined` when the badge itself has none (caller's name dropped). Handlers in `extra` are composed, so the other attributes are evidently meant to reach the label; class should be joined and aria-label should fall back to `extra`'s.
- evidence: read
- severity: low

## `onClick` on a `<span>` badge fires only when the badge happens to be split, so adding a tooltip changes whether a click acts
- where: packages/ui/src/components/Badge/BadgeRoot.tsx:33 (BadgeRoot span branch); packages/ui/src/components/Badge/BadgeLabel.tsx:49-52 (BadgeTarget)
- scenario: `<Badge as="span" onClick={f} onRemove={g}>x</Badge>` → `split` is false (element span, no tooltip), BadgeRoot renders the span without `onClick`, and `f` never runs. Add `tooltip="…"` and `split` turns true; BadgeTarget's `shared.onClick` then calls `f` on the `role="img"` label. One prop set answers "does a span badge run onClick" both ways depending on an unrelated prop; either both paths should drop it or both should run it.
- evidence: read
- severity: low

## A fitted badge's own padding is measured only when the content resizes, so a padding change keeps the old clearance
- where: packages/ui/src/components/Badge/useInsets.ts:38-56 (useMeasured)
- scenario: a badge on a `fitsContent` base (`puzzle`, `quatrefoil`, `octant-spline`, `octant-bspline`) whose padding comes from its stylesheet, e.g. its `style` or a toggled class changing `--badge-pad-x` from 6px to 20px. `ownPadding(badge)` is read only at mount and inside the content element's resize observer, and the content element's border box does not change when its parent's padding does, so `measured.pad` stays at 6px. `fitted` is computed with the stale floor and subtracts the stale pad, so the insets are fit to the old padding: content clearance is wrong until something resizes the label. The badge element itself is not observed, and the effect's deps are only `[ref, enabled]`.
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

<!-- done: 4 findings, files read: 22 -->
