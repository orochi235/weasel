I couldn't write `.skulkr/out/findings.md` because the permission was not granted, so the whole findings document is below. 5 findings; all 10 listed files read.

# Audit round 64: `diagram.theme` findings

## Applying any theme removes the dash a diagram type gives its connectors, so a requirement diagram's dashed relationships turn solid
- where: packages/diagram/src/theme/themeWrites.ts:99-101 (restroked), :207-213 (themeWrites, connector branch)
- scenario: In a `requirement` diagram, `diagramTypeEdgeStroke(theme, REQUIREMENT_TYPE)` gives each new connector `dash: [4, 4]` (diagramTypes/edge.ts:14). Its callers are apps/chart/src/useChartDiagram.tsx:62 and diagram-formats' testing/authoredScene.ts:59. The connector's trait has no `ownLine`, because the dash came from the diagram type and not from `colors` (dataColors.ts:9-11). Then `applyDiagramTheme(scene, paper)` runs, even with the theme already in use. `edgeLook` builds `line` from `edgeStrokeOf(roleEdgeStyle(theme))`, which has no dash, and `own` does not contain `'dash'`, so `restroked` runs `delete next.dash`. Every relationship is redrawn solid. It should keep the dash the diagram type set, as building in that type draws it, or the build should mark that dash as owned.
- evidence: read
- severity: medium

## Applying a theme recolors a container or pool that names a theme role in the plain container colors
- where: packages/diagram/src/theme/themeWrites.ts:76-82 (boxLook)
- scenario: A `DataContainer` with `style: 'accent'` (dataTypes.ts:173-175) is built in the accent role's colors. `dataRegionStyle` → `themeRegionStyle` checks `themeRoleStyle(theme, r.style)` before anything else (dataStyles.ts:42-43). `boxLook` decides the same thing differently: a node with a container role always gets `theme.container`, `theme.lane.header` or a lane body, never its own role. dataContainerPlace.ts:142 also never writes `style` into the trait. So `applyDiagramTheme(scene, sameTheme)` turns an accent container into the plain container colors, and switching themes never draws it in the new theme's accent role. There should be one answer: record the role in the trait, and have `boxLook` use `roleStyle` for a region that names one, as `themeRegionStyle` does.
- evidence: read
- severity: medium

## When a theme changes an off-page tag's font size or family, the tag's box keeps its old size
- where: packages/diagram/src/theme/themeWrites.ts:160-165 (paintTag); packages/diagram/src/theme/applyTheme.ts:45-54 (writeAll)
- scenario: The box behind a tag is sized once from its text, by `offPageTagSize`, when the tag is made (offPage/tag.ts:80). It is sized again only when its text changes (offPage/install.ts:87-99). `paintTag` moves the tag's `fontSize` by `labelStep` and sets `themeLabelFamily(theme)`. But `writeAll` re-lays out only bodies, and `labelFitOps` and `remeasureText` cover only `diagramLabelOf` labels. Going from paper (size 12) to a custom theme of size 18 grows the tag's text by 6 while its background box and its gap to the stub keep the 12-size measurement, so the text spills out of its box. The theme apply should re-measure the tag's pose as `offPageTagSize` would.
- evidence: read
- severity: low

## `setThemeValue` accepts values that `diagramThemeErrors` rejects, and the document then quietly redraws in `night`
- where: packages/diagram/src/theme/themeEdit.ts:70-73 (setThemeValue)
- scenario: `assertSettable` checks only the path. `setThemeValue(t, ['font', 'size'], 0)`, `NaN`, `-1`, or a string, and a color path given `''` or `'nope'`, all return a theme that fails `diagramThemeErrors`. Saved as `diagram:theme` through `applyDiagramTheme`/`themeDocValue`, that theme makes `diagramThemeFrom` fall back to `night` on the next read (resolve.ts:74), with only a development-mode warning. One bad number typed into a theme editor field switches the whole document's theme. It should throw a `RangeError` on a value the checker would refuse, as it already does for a bad path.
- evidence: read
- severity: low

## Applying a theme adds a fill to lanes, which building never gives them
- where: packages/diagram/src/theme/themeWrites.ts:78-81 (boxLook, lane) with :110 (paintBox)
- scenario: `regionData` builds a lane with no `fill` (containers/regionSpecs.ts:57, `role === 'lane' ? {} : { fill }`), both from data and from `firstLanes`/`addLane`. `boxLook` gives a lane `theme.lane.bodies[i]`, and `paintBox` → `recolored(undefined, body.fill)` writes a fill. Applying paper to a freshly built pool, even when it is already in paper, adds `#ffffff`/`#f5f7fa` stripes that the built pool did not have. Build and apply disagree on whether a lane has a fill; one of them should change so both agree.
- evidence: read (I did not run it to see how the painter draws a lane with no fill)
- severity: low

## Files read
packages/diagram/src/theme/applyTheme.ts
packages/diagram/src/theme/fromTokens.ts
packages/diagram/src/theme/resolve.ts
packages/diagram/src/theme/styleField.ts
packages/diagram/src/theme/themeEdit.ts
packages/diagram/src/theme/themeFile.ts
packages/diagram/src/theme/themeFixture.ts
packages/diagram/src/theme/themeWrites.ts
packages/diagram/src/theme/themes.ts
packages/diagram/src/theme/types.ts

<!-- done: 5 findings, files read: 10 -->