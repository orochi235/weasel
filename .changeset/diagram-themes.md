---
'@weasel-js/diagram': patch
---

Diagram themes. A `DiagramTheme` holds a style per role (`DIAGRAM_ROLES`: default, accent, muted, positive, warning, negative), connector and label colors, container and lane looks, a page color, a font, and a color series. `DIAGRAM_THEMES` ships `paper`, `night`, `blueprint`, `pastel`, and `mono`, and `diagramThemeFromTokens(read)` builds one from resolved `--wzl-*` values.

- A theme writes literal colors into the scene. `applyDiagramTheme(scene, theme)` recolors every shape, text row, group, connector, and label and saves the theme as the `diagram:theme` document value, as one undo entry; `themeWrites` is its pure half, and `diagramThemeOf` reads the value back.
- `DiagramNode` and `DiagramEdge` gain `style` (a role id) and `ownStyle` (the colors set by hand, which a theme leaves). `setDiagramStyle` names a role and recolors in it; `setDiagramColor` sets a fill, stroke, or text color by hand. `diagramStyleOf` reads either back.
- `DiagramSceneOptions.theme` draws each `DataNode` in its new `style` role, and edges, groups, labels, and text in the theme. `stencilBuild` and `useStencilInsert` take `font`. `roleStyle`, `roleEdgeStyle`, `themeEdgeStroke`, `themeFont`, `themeLabelFont`, and `themeLabelStyle` turn a theme into what the insert paths take.
- The effect looks take `theme` in their options (`LookThemeOptions`; default `night`, `LOOK_THEME`), reading stage styles, lane bodies, and type colors from it. Under `night` they draw exactly as before. `typeColors` takes the series and `stageStyle` and `sceneStyles` the theme, as optional last arguments.
