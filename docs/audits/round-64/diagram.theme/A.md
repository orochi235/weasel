I couldn't write `.skulkr/out/findings.md` because permission was denied, so here is the whole findings document.

# Audit round 64: diagram.theme

The brief's frozen commit 49e5a07e6aecc7037a5e3692706cf28dd58211c4 isn't in this repository (`git diff` reports "bad object"). This review read the working tree at HEAD 6f634fabe1.

## Applying a theme with no `header` leaves the previous theme's header band color in place
- where: packages/diagram/src/theme/themeWrites.ts:130 (paintBand)
- scenario:
  - A scene with a header body is built or applied in a custom theme whose role sets `header: '#ff0000'`. The body gets `headerFill: { paint: { color: '#ff0000' } }`, from dataColors.ts:53 or from `paintBand` itself.
  - Applying `paper`, where no role names `header`, hits `if (want === undefined …) return {}`. The old `headerFill` stays, and shape.ts:76 (`headerFill ?? declaredStroke`) keeps painting the band red.
  - The same body built directly in `paper` has no `headerFill` and draws its band in its stroke.
  - The apply should drop `headerFill` so the band follows the new stroke, as building in the theme does.
- evidence: read
- severity: medium

## setThemeValue writes values the theme checker rejects, and the document then silently draws in `night`
- where: packages/diagram/src/theme/themeEdit.ts:70 (setThemeValue)
- scenario:
  - Inputs that get through include `setThemeValue(theme, ['font','size'], 0)` (or `NaN`), `['font','family'], ''`, `['roles','accent','fill'], '#ff'` (a half-typed hex), and a number on a color path. The `string | number` signature allows all of these.
  - `assertSettable` only checks that the path exists, never the value.
  - `applyDiagramTheme` then applies the theme. With size 0, every text steps down by 12 and is clamped to 1. The whole theme is saved as `diagram:theme`.
  - From then on, `diagramThemeOf` (resolve.ts:65) fails `diagramThemeErrors` (`size > 0`, non-empty family, parseable color) and returns the `night` fallback.
  - So the next apply's `from` is `night`, `setDiagramColor` and `setDiagramStyle` color in `night`, and the next value edit forks `night` instead of the document's theme.
  - The writer lets in values that the reader of the same document refuses. `setThemeValue` should apply the same rules `diagramThemeErrors` uses at that path.
- evidence: read
- severity: medium

## Applying a theme keeps the old theme's connector markers and trim, which building in the theme would set
- where: packages/diagram/src/theme/themeWrites.ts:168 (edgeLook), :95 (restroked)
- scenario:
  - The theme file accepts `edge.markerStart`, `edge.markerEnd` and `edge.trim` (themeFile.ts:49–50).
  - `diagramScene` paints these into each connector's stroke through `edgeStrokeOf(dataEdgeStyle(e, theme))` (dataEdges.ts:112).
  - Take a scene built in `paper`, where `markerEnd` defaults to `'arrow'`. Give it a custom theme with `edge: { …, markerEnd: null, trim: { start: 4 } }`. Every arrowhead stays and no trim is drawn.
  - The cause: `edgeLook` passes only width and dash into `restroked`, which rewrites only color, width and dash.
  - The same data built in that theme draws no arrows and has the trim. Commit c39e272012 made apply match build for width and dash. Markers and trim still differ between the two paths.
- evidence: read
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

<!-- done: 3 findings, files read: 10 -->