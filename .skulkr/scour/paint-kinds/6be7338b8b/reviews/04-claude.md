# Findings: paint-kinds

## A mesh paint without `patches`, or a gradient without `stops`, makes `withPaintKind` throw, while `colorOf` on the same paint tolerates the gap
- where: packages/paint-kinds/src/meshKind.ts:25 (meshGradientKind.stopsOf); packages/paint-kinds/src/paintKinds.ts:89 (gradientKind stopsOf)
- scenario: `colorOf` is written defensively: `asMesh(paint).patches?.[0]?.colors?.[0]` and `firstStop((paint as Partial<GradientPaint>).stops)`. `stopsOf` is not. Take a partial paint loaded from JSON, `{ kind: 'mesh-gradient' }`, and call `withPaintKind(p, 'linear-gradient')`. It calls `meshStops(asMesh(paint))`, which runs `mesh.patches.filter(...)` and throws a TypeError. The swatch and the SVG fallback read that same paint without trouble. Likewise `{ kind: 'linear-gradient' }` with no `stops`, converted to `mesh-gradient`, reaches `meshFromStops(undefined)` → `stops.length` and throws. The conversion should treat a missing list as empty, the way `colorOf` does, or `withPaintKind` should return `undefined`.
- evidence: read (meshPaint.ts:158-159 `mesh.patches.filter`; meshPaint.ts:136 `stops.length`)
- severity: low
- fix: packages/paint-kinds/src/meshKind.ts, packages/paint-kinds/src/paintKinds.ts
- size: line
- cause: the two slots guard the same input differently
- confidence: likely

## The mesh kind's `colorOf` reads the first patch even when the renderer skips it as invalid
- where: packages/paint-kinds/src/meshKind.ts:23 (meshGradientKind.colorOf)
- scenario: Take a mesh whose `patches[0]` has the wrong number of points, say 8, followed by one valid patch. `isValidPatch` rejects the first patch, so nothing draws it, and `meshStops` filters it out too. `colorOf` still returns `patches[0].colors[0]`. The fallback swatch and the SVG fallback color (which `@weasel-js/svg` takes from `colorOf`) then show a color the painted mesh never contains. It should read the first valid patch, as `meshStops` does.
- evidence: read (surface.ts:47 `isValidPatch`; meshPaint.ts:159)
- severity: low
- fix: packages/paint-kinds/src/meshKind.ts
- size: line
- cause: two answers to "which patch counts"
- confidence: likely

## Files read
packages/paint-kinds/src/icons.gen.ts
packages/paint-kinds/src/icons.table.ts
packages/paint-kinds/src/index.ts
packages/paint-kinds/src/mesh.ts
packages/paint-kinds/src/meshKind.ts
packages/paint-kinds/src/meshKindLazy.ts
packages/paint-kinds/src/paintKindEntry.ts
packages/paint-kinds/src/paintKinds.ts
packages/paint-kinds/src/react.ts
packages/paint-kinds/src/svgNative.ts
packages/paint-kinds/src/test-seams.ts
packages/paint-kinds/src/tileSvg.ts
packages/paint-kinds/src/usePaintKinds.ts

<!-- done: 2 findings, files read: 13 -->
