# @weasel-js/stroke

A stroke as geometry: the mesh a renderer draws for it, the marker heads that
cap it, and the region its ink covers as a path.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/api/).

```sh
npm install @weasel-js/stroke
```

A path comes from `@weasel-js/geom` and the `Stroke` describing how to draw
its line from `@weasel-js/paint`. This package turns the pair into triangles or
into another path. It has no scene graph, no renderer, and no React.

## The ribbon

`tessellateStroke(path, stroke, options)` answers a triangle mesh: width, cap,
join, miter limit, dash, alignment, and per-vertex widths are all in it.
`resolveStrokeWidth` turns a `{ px }` width into path units at a given scale.

A stroke that must stay a fixed number of screen pixels wide under a
non-uniform zoom is built in a *stroke metric*, the linear part of the
transform it will be drawn through. `strokeSpaceOf` makes one, and the
`polylineIntoMetric` / `coordsOutOfMetric` family moves points in and out of
it.

## Markers

A marker is a shape drawn at a stroke's start, end, or interior vertices: an
arrowhead, a dot, a bar. `registerMarker` adds one under a key, and a `Stroke`
names it in `markerStart`, `markerMid`, or `markerEnd`. `BUILTIN_MARKERS` lists
the ones registered from the start.

`markerSites` finds where markers sit along a polyline and at what angle.
`markerHeads` places each registered shape on its site and answers the
geometry, unpainted. `markerInset` and `strokeInsets` say how far to pull the
line back so it ends inside the head, and `markerReach` how far a stroke's
heads can paint from the vertex they sit on.

## A stroke as a path

`strokeToPath(path, stroke)` answers the outline of everything above as one
fillable path: the ribbon and its heads, unioned. Curves are flattened, so the
result holds only straight segments.
