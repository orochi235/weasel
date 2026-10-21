---
"@weasel-js/geom": patch
---

`trianglesToPath` unions a mesh by its outline instead of by its triangles. Edges that two
triangles share in opposite directions cancel, and what is left is swept once under the nonzero
rule, so the sweep no longer splits every interior edge at every other edge crossing it. A stroke
whose ribbon overlaps itself all along — `strokeToPath` on 300 tall, narrow humps — used to make
polygon-clipping give up ("Infinite loop when passing sweep line over endpoints"); it now
outlines, and shorter ones of the same shape take about a third of the time they did.
