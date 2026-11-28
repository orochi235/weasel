# Findings: paint-kinds

## Gradient seed reads only exact white as white, so a near-white color seeds an invisible white-to-white ramp
- where: packages/paint-kinds/src/paintKinds.ts:105 (twoStopRamp)
- scenario: switching a solid `#fefefe` (or `#fafafa`, `whitesmoke`, `oklch(0.99 0 0)`) to Linear/Radial/Conic calls `seed` → `twoStopRamp`; `isWhite` requires r, g and b to equal exactly 1, so the end stop is `#ffffffff` and the seeded gradient shows no visible ramp. A contrasting end should be picked by lightness, not by exact equality to white.
- evidence: read
- severity: low
- size: line
- cause: exact equality instead of a lightness threshold
- confidence: likely

## `image` and `texture` entries' `seed` returns a hatch paint, breaking the `seed` contract
- where: packages/paint-kinds/src/paintKinds.ts:44 (BUILTINS image/texture `seed`)
- scenario: an editor offering the `image` or `texture` entry calls `entry.seed(color)` to switch a solid to that kind ("a paint of this kind seeded from a color", paintKindEntry.ts:56). It gets `{ kind: 'hatch', … }`, so `paintKindOf(result).id === 'hatch'`, not the kind that was picked, and the kind bar lands on Hatch instead of Image or Texture. The entry has no way to say "can't be seeded", so every caller has to special-case these two ids or show the wrong kind.
- evidence: read
- severity: low
- fix: packages/paint-kinds/src/paintKindEntry.ts, packages/paint-kinds/src/paintKinds.ts
- size: design
- cause: an unseedable kind is forced to fit a seed slot that every kind must have
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
