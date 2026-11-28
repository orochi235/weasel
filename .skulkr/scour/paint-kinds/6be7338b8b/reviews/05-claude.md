## A gradient's `colorOf` names the first of several stops tied at the lowest offset, while the renderer paints the last of them
- where: packages/paint-kinds/src/paintKinds.ts:97 (firstStop)
- scenario: a linear gradient whose stops are `[{offset:0,color:'#ff0000ff'},{offset:0,color:'#00ff00ff'},{offset:1,color:'#0000ffff'}]` (a hard break at the start). `sampleResolvedStops` (packages/paint/src/gradient.ts:58–63: "the last of them wins, as in CSS") paints green at t=0, but `firstStop` keeps the first stop it meets with the smallest offset (strict `<`), so `colorOf` returns red. The SVG paint fallback (`paintFallback` in packages/svg/src/paintServers.ts) and any fallback swatch then show a color the gradient never paints at its start. It should return green.
- evidence: read
- severity: low
- size: line
- cause: strict `<` keeps the first tie; the sort is stable, so the painted stop is the last tie in write order (`<=` picks it)
- confidence: sure

## `derivedList` re-implements registry's `createValuesReader`
- where: packages/paint-kinds/src/paintKinds.ts:190 (derivedList / allKinds)
- scenario: `allKinds = derivedList((all) => all.map((e) => e.value))` is the same thing as `createValuesReader(KINDS.reflection)` (packages/registry/src/reflectable.ts:289): a frozen array of live values that stays the same until `entries()` changes. So the question "the registry's values as a stable snapshot" has two answers. Right now they behave the same, but a change to one, such as the ordering or freezing rules, would not reach the other. `allKinds` should use `createValuesReader`, and `gradientKinds` should derive from its output.
- evidence: read
- severity: low
- size: function
- cause: duplicate snapshot helper
- confidence: sure

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
