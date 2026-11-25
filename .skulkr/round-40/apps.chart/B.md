## snapGaps and autoLayout draw boxes on pixel 0 and pixel 15, so their 1.5 stroke inks past the 20×20 viewBox and is clipped
- where: apps/chart/icons/actions.mjs:15 (ACTIONS.snapGaps), apps/chart/icons/actions.mjs:19 (ACTIONS.autoLayout)
- scenario: `box(0, …)` puts the left edge at px(0) = 0.625 and `box(12, …, 15, …)` the right at px(15) = 19.375. At ICON_STROKE 1.5 the ink runs from -0.125 to 20.125. autoLayout's root (top 0) and children (bottom 15) overrun the same way vertically. The outer 0.125 of each edge stroke falls outside the viewBox and is cut off, and the mitred corners (stroke-linejoin="miter") lose more. Those edges draw thinner than the glyph's other strokes, and the corners lose their points. docs/icons.md ("Solve extents from the ink box you want") asks for extents worked out from the ink box. A 1.5 stroke centred on pixel 0 or pixel 15 fits only by being clipped. Expected: inset the outer boxes so the ink stays inside 0..20 (e.g. ink 1.25..18.75, as in the docs' example).
- evidence: read
- severity: low

## Files read
apps/chart/icons/actions.mjs
apps/chart/icons/index.mjs
apps/chart/vite.config.ts

<!-- done: 1 findings, files read: 3 -->
