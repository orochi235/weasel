## `nativeSvgKind('texture')` reports a native SVG form, so a texture fill exports as a bare dangling `url(#id)` with no fallback
- where: packages/paint-kinds/src/svgNative.ts:11 (nativeSvgKind)
- scenario: a node filled with `{ kind: 'texture', texture: … }` goes through `@weasel-js/svg`. `PaintServerRegistry.ref` (packages/svg/src/paintServers.ts:53) asks `nativeSvgKind`, gets `true`, and writes `fill="url(#patN)"` with no fallback color. But `patternXml` writes no `<defs>` entry for a texture (packages/svg/src/patterns.ts:9, 31: "exports as nothing, with a warning"). The reference points at nothing, and with no fallback the shape loses its fill in every SVG viewer. It should be treated as non-native (fallback color after the `url()`), or dropped. `GradientEditor`'s `svg` filter has the same false positive.
- evidence: read
- severity: medium

## A white seed color written as `#fff`, `white` or `rgb(255,255,255)` seeds an invisible white-to-white gradient
- where: packages/paint-kinds/src/paintKinds.ts:98 (twoStopRamp)
- scenario: the white check is `color.slice(0, 7).toLowerCase() === '#ffffff'`. `PaintInput.switchKind` seeds from the solid's raw `color` string (packages/ui/src/components/PaintInput/PaintInput.tsx:170, 194), and that string can be any CSS color. A solid `'#fff'` or `'white'` switched to Linear gives stops `[white, #ffffffff]`, a flat white paint, where the comment promises black against white. It should compare the parsed color, not a hex prefix.
- evidence: read
- severity: low

## A lazily loaded kind that fails `registerPaintKind`'s validation is dropped silently and never retried
- where: packages/paint-kinds/src/paintKinds.ts:165 (registerPaintKindLoader's `register`)
- scenario: a loader resolves to an entry that has `stopsOf` but no `fromStops`, or only one of `toLocalUnits`/`toBoundsUnits`. `registerPaintKind` throws inside `startLoad`'s fulfillment callback (packages/renderer/src/paintKinds.ts:286). That callback's own `failed` rejection handler does not catch it, so nothing calls `console.error`. `getPaintDrawKind`'s `.catch(() => {})` then swallows the rejection, and `loader.started` keeps it, so the kind stays unknown with no diagnostic. A statically registered kind with the same mistake throws a clear error. Only `warmPaintKinds` would surface it.
- evidence: read
- severity: low

## `withPaintKind` skips a registered override of a built-in gradient kind
- where: packages/paint-kinds/src/paintKinds.ts:226 (withPaintKind)
- scenario: a consumer overrides `'radial-gradient'` with `registerPaintKind({ id: 'radial-gradient', …, fromStops: custom })`. The function looks up `to = getPaintKind(kind)`, which returns the override. It then branches on the hard-coded `isGradientPaint` test and calls `withGradientKind`, so the override's `fromStops` and `stopsOf` never run. The registry answers "how do I build this kind" in one place, and this branch answers it again by kind name.
- evidence: read
- severity: low

## A gradient's `colorOf` reads `stops[0]` by array position, not by lowest offset
- where: packages/paint-kinds/src/paintKinds.ts:87 (gradientKind colorOf)
- scenario: stop lists are not required to be sorted (`@weasel-js/paint` sorts them before baking, gradient.ts:25). A linear gradient `stops: [{offset: 1, color: red}, {offset: 0, color: blue}]` draws blue at its start, but `colorOf` returns red. That is the color an SVG fallback and an editor switching back to solid then use. It should take the stop with the smallest offset.
- evidence: read
- severity: low

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

<!-- done: 5 findings, files read: 13 -->
