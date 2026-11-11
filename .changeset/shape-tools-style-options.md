---
'@weasel-js/core': patch
---

Shape tools draw with fill, stroke and stroke-width tool options that every shape tool shares.

Rect, ellipse, polygon, star, line, pencil and pen declare `fill`, `stroke`, `strokeWidth` and (for paths) `fillRule`, each shared with every shape tool; text declares a `fill` shared under `textFill`. Polygon's sides, star's points and inner radius, the pen's auto-commit-on-close, and the sticky note's paper and ink are per-tool options, whose defaults the hooks' `sides`, `points`, `innerRatio` and `autoCommitOnClose` and the sticky tool's `background` and `fill` set. Every insert tool takes a `share`.

The insert action hands the style to the `insert` dep as `extras.style`; an insert carrying none still cycles the kit palette. The options tune their actions only while their tool is active, beneath any other tuning, and a canvas whose host publishes no `toolOptionValues` keeps them in memory. `useToolOptionParams` reads a tool's options for an options row, re-rendering on a shared change. The option sets are exported: `RECT_TOOL_OPTIONS` and the rest, `shapeToolOptions`, `DEFAULT_SHAPE_PAINT`.

Breaking: `<SceneCanvas insertPaint>`, `InsertPaint` and `paletteInsertPaint` are gone; set the shape tools' options instead. `usePenTool.prefs` is gone, replaced by `PEN_TOOL_OPTIONS`.

<!-- entry: rank=20 breaking new api -->
