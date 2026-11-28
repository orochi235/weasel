# paint-kinds — blind review findings

## `seedTile('chunks', …)` seeds a fully transparent ground, so the "ground" the comment requires is never there
- where: packages/paint-kinds/src/paintKinds.ts:79 (seedTile)
- scenario: an editor switches a solid to Chunks → `{ kind: 'chunks', color, bg: '#00000000', units: 'bounds' }`. `tileGeometry` (packages/renderer/src/patterns/tileGeometry.ts:87) pushes a full-tile rect in `spec.bg`, here alpha 0, so the tile draws exactly as with no `bg` (plus one invisible rect per tile) — the scatter reads as "loose specks on whatever sits beneath", the outcome the comment says the `bg` exists to prevent. Either the seed should carry a visible ground (e.g. a contrasting color, as `twoStopRamp` picks for gradients) or the comment/field is wrong.
- evidence: read
- severity: low
- fix: packages/paint-kinds/src/paintKinds.ts
- size: line
- cause: transparent placeholder bg
- confidence: likely

## `nativeSvgKind` decides by kind name, so an override of a native kind registered with `registerPaintKind` is never serialized through its own `toSvg`
- where: packages/paint-kinds/src/svgNative.ts:11 (nativeSvgKind)
- scenario: a consumer calls `registerPaintKind({ id: 'linear-gradient', …, toSvg })` — the registry documents re-registering an id as an override, and `withPaintKind` honors overrides (it skips `withGradientKind` when either side is not the built-in entry). On SVG export, `hasNativeSvgForm` (packages/svg/src/paintServers.ts:10) asks `nativeSvgKind('linear-gradient')` → true, so the reference carries no fallback color and no `wzl:` namespace, and `paintServerXml` takes the built-in `gradientXml` path before ever consulting the entry. The override's `toSvg` and `colorOf` are silently dropped for export while the renderer and editor use the override: one decision (is this kind the built-in one?) answered by identity in `withPaintKind` and by name here.
- evidence: read
- severity: low
- fix: packages/paint-kinds/src/svgNative.ts, packages/svg/src/paintServers.ts
- size: function
- cause: native check by name, not by live entry
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
