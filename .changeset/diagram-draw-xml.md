---
"@weasel-js/diagram-formats": patch
"@weasel-js/diagram": patch
"@weasel-js/svg": patch
---

`@weasel-js/diagram-formats` reads and writes draw-style XML as `DRAW_XML`, listed in
`DIAGRAM_FORMATS`. It is the format that keeps a chart laid out: one `<diagram>` per page, each a
graph model of cells with a style string and a geometry. Reading takes pages written out or
compressed (base64 of raw deflate of the URI-encoded model), and a bare graph model as one page.
It keeps places and sizes, outlines (rhombus, ellipse, hexagon, parallelogram, trapezoid, and a
rounded rect of arc size 50 or more as a stadium), fill, stroke, and font colors, font size,
family, and bold, HTML text with its tags stripped and its breaks kept, containers, swimlane pools
of lanes, groups, routers, waypoints, exit and entry points as the nearest compass port, edge
labels and where along the edge they sit, and arrowheads. A shape it does not know becomes a rect,
with a warning, as do edges with a loose end and merged layers. Writing spells out every color
under the document's theme, lays out a page whose nodes have no place, writes an avoiding
connector as orthogonal along its route, and leaves out edges between pages, with a warning.

`@weasel-js/diagram` exports `NODE_STROKE_WIDTH`, `LANE_STROKE_WIDTH`, and `EDGE_STROKE_WIDTH`,
the outline widths it draws with when a style gives none. `@weasel-js/svg` exports `escapeAttr`
and `escapeText`, the escaping it writes XML with.
