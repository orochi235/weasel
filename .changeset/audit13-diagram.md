---
'@weasel-js/plot': patch
'@weasel-js/guides': patch
'@weasel-js/parallax': patch
'@weasel-js/diagram': patch
'@weasel-js/diagram-formats': patch
---

Fixes for hangs and crashes far from the origin, at a zero gap, and on Mermaid ids given twice.

- A gantt task counted in days or weeks from a start past what a `Date` holds (a huge `x` or `X` date) is no longer walked day by day, which never ended.
- `rulerTicks` lays out no ticks once the view is panned so far that ticks a step apart are one number, where the tick loop never ended.
- `linesIn` lists no lines of a pitch that far out, where it grew an array until it threw, so a grid layer drawn there draws none.
- `snapPoint`'s grid pattern counts its points from 0, so a dragged pose too far out for grid indices to count offers points instead of hanging.
- A tiled parallax layer panned that far draws no copies, where its copy loop never ended.
- The avoid router checks an item or query so far out that its cell indices stop counting by its box, where the spatial hash's cell walk never ended.
- The avoid router files an obstacle in its visibility graph only over the search window and its points, in at most 4096 strips. An obstacle running to infinity, or spanning a vast window, ran out of memory, and a box with a NaN side left every other obstacle out of the graph.
- `layered` with a `nodeGap` of 0 places nodes joined by a long edge at finite positions; every node landed at NaN.
- A Mermaid architecture diagram naming a service, junction or group twice is refused, naming the line, as Mermaid refuses it. Before, it read into a page that could not be drawn or written.
- A Mermaid mind map node repeating another's id reads with a unique one (`a_2`), as Mermaid draws both. Before, the page could not be drawn or written.
