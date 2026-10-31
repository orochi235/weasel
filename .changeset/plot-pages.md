---
"@weasel-js/diagram-formats": patch
---

Add plot pages. `DocumentPage` gains `PlotPage` (`kind: 'plot'`, `data: PlotData` from `@weasel-js/plot`):
`documentSpecs` draws one as a plot root filling the page, in the theme's colors (`plotThemeOf`), and
`documentFromScene` reads a page holding a plot root back as a plot page. The JSON format holds plot pages, and the
Mermaid format reads and writes `xychart-beta` (`readMermaidXychart`, `writeMermaidXychart`). An SVG page export now
folds a node's pose through any parent whose pose is a frame, as a plot root's is.
