## Composed shapes' declared `insets` are never read, so House, Coffin and Hexagon labels get the polygon base's 0/4/0/4 padding instead of their tuned values
- where: packages/ui/src/components/Badge/shapes/House.tsx:34, Coffin.tsx:46, Hexagon.tsx:36 (also Beavis.tsx:46, Cloud.tsx:34, Plaque.tsx:34, Postage.tsx:27, Scalloped.tsx:27, Quatrefoil.tsx:42)
- scenario: Every shape with `compose` routes through `Badge.tsx:171`, which calls `useInsets(composeBase ?? shapeModule, …)`; once `compose()` names a base, the base's insets are used and the shape's own `insets` is dead (Ribbon.tsx:22 says so for ribbon). `<Badge shape="house">` therefore pads its label `{top:0, right:4, bottom:0, left:4}` (Polygon.tsx:20), not the `top: 10` House declares to keep text below the eave (eave at y=32%, the box corners above it lie outside the house). The same goes for `coffin`, which declares `left: 11` because its head is only 6% in and 46% tall, and gets `left: 4`; and for `hexagon`, which declares 4/6/4/6 and gets 0/4/0/4 while its tips cut the box corners. Result: label text sits over or past the silhouette's slanted edges. Expected: the shape's declared insets, or a fitted inset, apply on the compose path, or the dead declarations go and the bases cover the geometry.
- evidence: read (Badge.tsx:171-176, useInsets.ts:108, bases/Polygon.tsx:20; no other reader of `SHAPES[x].insets` outside tests)
- severity: medium

## NaN in a continuous shape param reaches the drawn path, while repeat counts map NaN to their minimum
- where: packages/ui/src/components/Badge/shapes/Crest.tsx:13 (crestPath), Coffin.tsx:26-31, House.tsx:16-18, Hexagon.tsx:15-16 (hexVerts), Notched.tsx:35-36, Shield.tsx:32-36, Receipt.tsx:50 (insets)
- scenario: The clamps are `Math.max(lo, Math.min(x, hi))`, which return NaN for NaN. A caller whose number field was cleared (`Number('')` is 0 but `parseFloat('')` is NaN) passes `shapeParams={{ topInset: NaN }}` to a crest: `d` becomes `"M NaN 6 Q NaN 0 …"`, the browser rejects the attribute and the badge draws no outline. Coffin/House/Hexagon NaN vertices feed `polygonSampler`, giving a NaN `totalCss` and NaN body path; Receipt's `sideToTopRatio: NaN` yields `--badge-inset-left: NaNpx`. `params.ts:16` (`repeatCount`) states the opposite rule for counts in the same directory ("NaN and anything below `min` read as `min`"). Expected: one rule — NaN reads as the default or the bound — for every clamped param.
- evidence: read
- severity: low

## `SHAPES` is a plain object, so a runtime shape name like `"constructor"` resolves through Object.prototype instead of falling back to pill
- where: packages/ui/src/components/Badge/shapes/index.ts:52 (SHAPES)
- scenario: `Badge.tsx:155-156` falls back with `SHAPES[shape] ?? SHAPES.pill` and `SHAPES[shape] ? shape : 'pill'`. A shape string from untyped input (a lab URL, saved JSON) of `"constructor"`, `"toString"` or `"hasOwnProperty"` returns an inherited function: the badge gets `data-shape="constructor"`, no `defaults`, no `Component`/`compose`, and renders no outline and no CSS shape, where an unknown name like `"foo"` correctly becomes a pill. `badgeShapeRendering('toString')` (catalog.ts:38) likewise answers `'svg'`. Expected: a null-prototype table or an own-key check, so every unknown name takes the pill fallback.
- evidence: read
- severity: low

## Beavis `cornerRadius` is in CSS px, but it reaches the base as a fraction of a fixed 22px height, so the drawn radius scales with badge height
- where: packages/ui/src/components/Badge/shapes/Beavis.tsx:26 (compose)
- scenario: `erosion = cornerRadius / 11` assumes a 22px-tall badge, and `RoundedRect.cornersFor` (bases/RoundedRect.tsx:58) multiplies erosion by `min(boxW, boxH) / 2` of the real box. With the default `cornerRadius: 6`, a 30px-tall `md` badge gets an 8.2px corner and a 16px `xs` badge gets 4.4px; `cornerRadius: 11` on a 40px badge is a full pill instead of an 11px corner. Expected: the requested px radius on any box size, e.g. erosion derived from the measured box, or the param documented and named as a fraction.
- evidence: read
- severity: low

## Receipt `tearDepth` has no upper bound, so deep tears cross the badge and self-intersect the outline
- where: packages/ui/src/components/Badge/shapes/Receipt.tsx:16 (receiptPath)
- scenario: `baseDepth = Math.max(1, depth)` with no cap, and a tooth reaches up to `1.1 × baseDepth` in from each side. At `tearDepth: 50` the right teeth reach x≈45 and the left ones x≈55, so the two edges cross and the fill/stroke draw a self-intersecting zigzag; at 100 the teeth leave the box entirely. The other shapes clamp their geometry so the outline stays simple (Hexagon `tipHeight ≤ 49`, Crest `topInset ≤ 35`, Coffin's X bounds). Expected: depth clamped so a tooth on each side cannot pass the centerline (≤ ~45).
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Badge/shapes/Beavis.tsx
packages/ui/src/components/Badge/shapes/Cloud.tsx
packages/ui/src/components/Badge/shapes/Coffin.tsx
packages/ui/src/components/Badge/shapes/Crest.tsx
packages/ui/src/components/Badge/shapes/Hexagon.tsx
packages/ui/src/components/Badge/shapes/House.tsx
packages/ui/src/components/Badge/shapes/Notched.tsx
packages/ui/src/components/Badge/shapes/Perforated.tsx
packages/ui/src/components/Badge/shapes/Pill.tsx
packages/ui/src/components/Badge/shapes/Plain.tsx
packages/ui/src/components/Badge/shapes/Plaque.tsx
packages/ui/src/components/Badge/shapes/Postage.tsx
packages/ui/src/components/Badge/shapes/Quatrefoil.tsx
packages/ui/src/components/Badge/shapes/Receipt.tsx
packages/ui/src/components/Badge/shapes/Ribbon.tsx
packages/ui/src/components/Badge/shapes/Scalloped.tsx
packages/ui/src/components/Badge/shapes/Shield.tsx
packages/ui/src/components/Badge/shapes/Sparkler.tsx
packages/ui/src/components/Badge/shapes/Square.tsx
packages/ui/src/components/Badge/shapes/Starburst.tsx
packages/ui/src/components/Badge/shapes/Urn.tsx
packages/ui/src/components/Badge/shapes/Wood.tsx
packages/ui/src/components/Badge/shapes/index.ts
packages/ui/src/components/Badge/shapes/params.ts

<!-- done: 5 findings, files read: 24 -->
