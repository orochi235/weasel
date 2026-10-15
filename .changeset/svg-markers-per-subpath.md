---
'@weasel-js/svg': patch
---

`serializeSvg` writes a marked stroke so SVG draws the markers the renderer draws. A path with several subpaths and a start, mid, or end marker is written one subpath to a `<path>`: SVG draws one start and one end marker per `<path>` and a mid marker on every vertex between them, subpath joins included, where the renderer caps each open subpath and marks no join. A fill over such a path is written once, under the strokes, so an even-odd hole stays a hole. A closed subpath, and a `rect` path, is written with no start or end marker, which SVG would draw at its first vertex and the renderer does not. Breaking for a reader of the output that expected one `<path>` per node: these nodes are now a `<g>` of paths, as a path split for `openFill: 'none'` already was.
