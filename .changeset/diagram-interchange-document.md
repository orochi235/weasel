---
"@weasel-js/diagram-formats": patch
"@weasel-js/diagram": patch
---

`@weasel-js/diagram-formats` gains the interchange document every diagram format reads and writes.
A `DiagramDocument` is a list of pages, each a sheet size and a `DiagramData` in coordinates from
the page's corner, plus the edges that run between pages and the theme. `documentFromScene(scene)`
reads a diagram scene into one, keeping only the colors the scene's theme would not give;
`documentSpecs(doc, { layer, theme, measure })` turns one back into scene specs and the
`core:pages` and `diagram:theme` document values, laying out once any page whose nodes are not all
placed. A `DiagramFormat` has `detect`, and `read` and `write`, each returning its warnings;
`DIAGRAM_FORMATS` lists them, `detectFormat` picks one by content and then by extension, and
`readDocument` reads a file with it. `DIAGRAM_JSON` is the first format: the document as JSON.

In `@weasel-js/diagram`, a `DataNode`, `DataEdge`, `DataContainer`, and `DataLane` take `colors`
of their own, which `diagramScene` draws over the theme and lists in the trait's `ownStyle`, so a
theme change leaves them. A `DataEdge` takes a theme role in `style`. `diagramScene` takes a
`layer`. `dataNodeStyle`, `dataEdgeStyle`, and `dataRegionStyle` give the style each data item is
drawn in.
