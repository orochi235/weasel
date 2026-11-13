---
'@weasel-js/diagram-formats': patch
---

A diagram page's SVG export draws a node any registered painter claims with that painter, as the canvas does.

The page exports are now `@weasel-js/export`'s, with the diagram painters and the diagram theme's page color added, and keep their names, options and defaults. A node no diagram painter claims, which was written by `svgLeafFromKit` whatever painted it on the canvas, is now written from the paths of the painter `registerNodeShape` registered for it, and any node deriving its path is drawn along it.

<!-- entry: behavior -->
