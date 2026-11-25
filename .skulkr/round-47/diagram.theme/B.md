# Audit round 47 — diagram.theme

## diagramThemeFromTokens copies `--wzl-fg-muted` verbatim, and the shipped token is relative color syntax no weasel parser reads
- where: packages/diagram/src/theme/fromTokens.ts:16 (diagramThemeFromTokens)
- scenario: under the shipped tokens, `read('--wzl-fg-muted')` (a `getComputedStyle(el).getPropertyValue` per the doc) returns the custom property's token stream, `rgb(from currentColor r g b / 0.7)` (packages/theme/src/generated/tokens.css:62, also :294 and :352). Custom properties are not computed to colors, so that string lands as-is in `roles.muted.text`, `edge.stroke`, `container.text` and the last `series` entry. `@weasel-js/paint`'s `tryParseColor` documents `currentColor` as unsupported (packages/paint/src/color.ts:22) and its `rgb` parser does not handle `from`. Two results: (1) connectors and muted text get painted with a color the kit's paint path cannot parse; (2) the theme fails the package's own check: `diagramThemeErrors` reports `edge.stroke: "rgb(from currentColor …)" is not a color`, so a document saved under "Match chrome" (saved whole, since it is not shipped) is refused on reopen by diagram-formats' `jsonFormat` ("whose theme does not check"), and `themeToJson` writes a theme file `parseDiagramTheme` rejects. Should: resolve each token to a parseable color (or fall back to `paper`'s when `tryParseColor` fails), the way an empty token already falls back.
- evidence: read
- severity: high

## A theme file passes the check with values the scene writers then paint or size with
- where: packages/diagram/src/theme/themeFile.ts:23-66 (checker / checkTheme)
- scenario: `checkTheme` validates only `fill`/`stroke`/`text` of each box and only `edge.stroke`, so a file with `"edge": {"stroke": "#000", "label": 42, "width": "wide"}`, a role with `"headerText": "nope"` or `"header": 5`, or `"strokeWidth": "x"` / `"dash": "x"` parses as a whole theme. Those values are used: `roleEdgeStyle` hands `edge.label` to every unroled connector label as its fill (resolve.ts:25 → themeWrites.ts:183), `paintBand` writes `header` into `headerFill` (themeWrites.ts:108-110), `rowColor` writes `headerText` into header rows (themeWrites.ts:102), and `edgeStrokeOf(theme.edge)` takes `width`. Also `"size": 1e400` parses to `Infinity` and passes `!(v.size > 0)`, so `font.size` is `Infinity` and every themed text row's step becomes `Infinity`. `"series": []` passes too, and the effect looks' `typeColors` then colors every port type `series[n % 0]` = `undefined` (packages/diagram/src/effect/draw.ts:73; compact/lanes/nodeGraph/rack pass `theme.series`), while diagram-formats' plotPages guards the same empty case (plotPages.ts:14), so the two readers disagree on whether empty is valid. Should: check every optional color/number field the type declares when present, require finite sizes, and require a non-empty `series` (or have all readers fall back).
- evidence: read
- severity: medium

## A text row sized near the floor loses its size across a theme round trip
- where: packages/diagram/src/theme/themeWrites.ts:119 (paintText)
- scenario: a row at `fontSize: 4` under a 20px custom theme; apply a 12px theme (step −8): `Math.max(1, 4 − 8)` = 1; apply the 20px theme again (step +8): 9. The row now sits at 9 where it started at 4, and nothing records the clamp, so undo is the only way back. Every theme switch is a relative step from `from`, so any clamp breaks the inverse. Should: either not clamp a relative step (keep the size the step can't take and skip the row), or record the unclamped size.
- evidence: read
- severity: low

## DiagramTheme.defaultRole's doc says a connector naming no role, or a role the theme lacks, is drawn in the default role; connectors take `theme.edge` instead
- where: packages/diagram/src/theme/types.ts:36 (DiagramTheme.defaultRole); behavior at packages/diagram/src/theme/resolve.ts:22-26 (roleEdgeStyle)
- scenario: a connector with `style: 'nonexistent'` (or none) under `paper`: the doc on `defaultRole` says it draws in `roles.default` (stroke `#3e4c59`, as it happens equal); under `night`, `roles.default.stroke` is `#3d566b` but `roleEdgeStyle` returns `theme.edge` (`#7ba7c7`) with `theme.label.fill` for its label. The `edge` field's own doc (line 38) agrees with the code, so the two docs on the type contradict each other; a caller writing a custom theme from the `defaultRole` doc expects connectors to follow the default role. Should: the `defaultRole` doc says "a shape" only.
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

<!-- done: 4 findings, files read: 10 -->
