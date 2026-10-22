# Working with paths

A [Path](#pkg/geom/reference/Path) is the shape type every weasel package
shares. This guide covers building one, reading and writing SVG path data,
measuring and transforming it, flattening its curves, and testing a point
against it.

## What a path is

`Path` is a union of two shapes, told apart by `kind`:

```ts
import type { Path, PolygonPath, RectPath } from '@weasel-js/geom';

const rect: RectPath = { kind: 'rect', x: 0, y: 0, width: 100, height: 60 };

const triangle: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([0, 1, 1, 4]),            // M L L Z
  coords: new Float32Array([0, 0, 100, 0, 50, 80]),
  fillRule: 'nonzero',
};
```

A `RectPath` is an axis-aligned rectangle. It exists so the most common shape
gets constant-time bounds and hit-testing without touching the polygon code.

A `PolygonPath` is an SVG-style command stream split across two typed arrays.
`commands` holds one code per command, and `coords` holds the coordinates those
commands consume, in order:

| Command | Constant | Coordinates consumed |
|---|---|---|
| Move to, opening a subpath | `PATH_M` | `x, y` |
| Line to | `PATH_L` | `x, y` |
| Cubic Bezier | `PATH_C` | `c1x, c1y, c2x, c2y, x, y` |
| Quadratic Bezier | `PATH_Q` | `cx, cy, x, y` |
| Close the subpath | `PATH_Z` | none |

A subpath is one contour: everything from a move up to the next move. A path
with several subpaths is how a shape gets a hole, such as the inside of a
letter "O". `fillRule` is `'nonzero'` or `'evenodd'` and decides which
overlapping regions count as inside.

A subpath with no closing `Z` is open. It strokes as a polyline. Whether it
also fills, closed by a straight edge back to its start the way SVG and canvas
do it, is set per path by the optional `openFill` field (`'close'` or `'none'`)
and otherwise by a package-wide default you can change with
`setDefaultOpenFill`. The default starts at `'close'`.

Every function below accepts either kind unless its signature names
`PolygonPath`. Narrow on `path.kind` before reading `commands` or `coords`.

## Build a path

[PathBuilder](#pkg/geom/reference/PathBuilder) hides the two arrays behind
chained calls and returns a `PolygonPath` from `build()`:

```ts
import { PathBuilder } from '@weasel-js/geom';

const leaf = new PathBuilder()
  .moveTo(0, 0)
  .quadTo(50, -40, 100, 0)                 // control point, then end point
  .curveTo(80, 30, 20, 30, 0, 0)           // two control points, then end point
  .close()
  .build();

// Extend an existing polygon path with more segments.
const longer = PathBuilder.fromPath(leaf).moveTo(120, 0).lineTo(160, 0).build();
```

`setFillRule('evenodd')` on the builder changes the rule; the default is
`'nonzero'`.

For common shapes there are one-call builders:

| Function | Arguments | Result |
|---|---|---|
| `rectPath` | `x, y, width, height` | A `RectPath`. |
| `polygonFromPoints` | `points`, optional `{ fillRule }` | A closed polygon through `{ x, y }` points. |
| `polylineFromPoints` | `points` | The same without the closing edge. An empty list returns a zero-size `RectPath`. |
| `linePath` | `a, b` | An open two-point line. |
| `ellipsePath` | `{ x, y, width, height }` | An ellipse inscribed in those bounds, as cubic curves. |
| `regularPolygonPath` | `center, radius, sides`, optional `rotation` | A closed regular polygon. `rotation` is in radians, and 0 puts the first vertex on the +x axis. |
| `starPath` | `center, outerRadius`, optional `points, innerRadius, rotation` | A closed star. `points` defaults to 5, and `innerRadius` to half the outer one. |
| `circlePath` | `cx, cy, r`, optional `segments` | A circle approximated by straight segments, 32 by default. |
| `roundRectPath` | `x, y, width, height, r`, optional `cornerSamples` | A rounded rectangle with straight-segment corners. `r` is clamped to half the shorter side. |

`ellipsePath` gives true curves, and `circlePath` gives a fixed polygon. Use
the first for a shape that will be scaled or edited, and the second for a small
marker.

To turn sampled points, such as a freehand stroke, into smooth curves, use
[schneiderFit](#pkg/geom/reference/schneiderFit). It takes the samples and an
error tolerance in the samples' units, and returns a `PolygonPath` of cubic
segments that stays within that distance of them:

```ts
import { schneiderFit } from '@weasel-js/geom';

const samples = [{ x: 0, y: 0 }, { x: 12, y: 9 }, { x: 30, y: 11 }, { x: 52, y: 2 }];
const smooth = schneiderFit(samples, 2);
```

## Read and write SVG path data

[pathFromD](#pkg/geom/reference/pathFromD) parses the value of an SVG `d`
attribute into a `PolygonPath`. It accepts every SVG path command in absolute
and relative form. The stored path only has the commands in the table
above, so `H` and `V` become lines, the smooth forms `S` and `T` become plain
cubic and quadratic curves with the reflected control point filled in, and
arcs become cubic curves.

```ts
import { pathFromD } from '@weasel-js/geom';

const path = pathFromD('M0 0 H50 V30 Z');
// commands: M L L Z      coords: 0,0  50,0  50,30

const warnings: string[] = [];
pathFromD('M0 0 L10 10 X5', (message) => warnings.push(message));
```

An unknown command letter is skipped and reported to the optional second
argument. Data that does not start with a move builds an empty path, and a
command with the wrong number of arguments ends the path just before it, which
is how a browser renders both.

The package has no function that writes a `d` string. Write one by walking the
stream with [forEachSegment](#pkg/geom/reference/forEachSegment), which calls
back with each command code and the offset of its first coordinate:

```ts
import {
  PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z, forEachSegment, type PolygonPath,
} from '@weasel-js/geom';

function toD(path: PolygonPath): string {
  const { commands, coords } = path;
  const parts: string[] = [];
  forEachSegment(commands, coords, (cmd, i) => {
    const take = (count: number) => Array.from(coords.subarray(i, i + count)).join(' ');
    if (cmd === PATH_M) parts.push(`M${take(2)}`);
    else if (cmd === PATH_L) parts.push(`L${take(2)}`);
    else if (cmd === PATH_Q) parts.push(`Q${take(4)}`);
    else if (cmd === PATH_C) parts.push(`C${take(6)}`);
    else if (cmd === PATH_Z) parts.push('Z');
  });
  return parts.join(' ');
}
```

The callback also receives the pen position before the command, as its third
and fourth arguments, which is the start point of that segment. Return `false`
from it to stop the walk early.

## Measure a path

[boundsOfPath](#pkg/geom/reference/boundsOfPath) returns the tight bounding box
as a `RectPath`. For curves it uses the points where the curve actually turns,
not the control points, so the box does not overshoot. An empty path gives a
zero-size rect at the origin.

```ts
import { boundsOfPath, ellipsePath, pathFromD, unionBoundsPath } from '@weasel-js/geom';

const triangle = pathFromD('M0 0 L100 0 L50 80 Z');
boundsOfPath(triangle); // { kind: 'rect', x: 0, y: 0, width: 100, height: 80 }

const dot = ellipsePath({ x: 150, y: 0, width: 20, height: 20 });
unionBoundsPath([triangle, dot]); // { kind: 'rect', x: 0, y: 0, width: 170, height: 80 }
```

`unionBoundsPath` takes any iterable of paths and returns `null` when it is
empty.

`pathSignedArea(path)` returns the enclosed area, positive for a contour that
runs clockwise on a y-down screen. Its sign tells you which way a contour
winds, and `reversePath` returns the same polygon path wound the other way.
Under `'nonzero'`, two overlapping contours fill their overlap only when they
wind the same way, so check this before combining contours from different
sources into one path.

## Transform a path

Each transform returns a new path and leaves the input alone.

```ts
import {
  boundsOfPath, multiply, rectPath, rotateAboutPoint, scale, scalePathToBounds,
  transformPath, translatePath,
} from '@weasel-js/geom';

const box = rectPath(0, 0, 40, 20);

translatePath(box, 10, 5);                // still a RectPath, at (10, 5)
transformPath(box, scale(2, 2));          // still a RectPath, 80 by 40

const tilted = transformPath(box, rotateAboutPoint(20, 10, Math.PI / 6));
tilted.kind;                              // 'polygon'

// Fit a path into a target box, as a resize handle does.
const fitted = scalePathToBounds(tilted, rectPath(0, 0, 100, 100));
boundsOfPath(fitted);                     // the 100 by 100 target, to float32 precision

// Compose transforms with multiply(m, n), which applies n first.
const spun = transformPath(box, multiply(scale(2, 2), rotateAboutPoint(20, 10, Math.PI / 6)));
```

[transformPath](#pkg/geom/reference/transformPath) takes any `Mat3`. A
`RectPath` stays a rect under translation and axis-aligned scaling, including a
mirror, and becomes a four-corner polygon under rotation or shear. That is why
these functions return `Path` and not the kind you passed in.

`scalePathToBounds` maps the path's current bounding box onto the target. If
the source has zero width or height, that axis is moved without being scaled.

## Flatten to polylines

Flattening replaces each curve with enough straight segments to stay within a
tolerance of it. `extractPolylines`, from the `./tessellate` entry, does this
for a whole path and returns one polyline per subpath:

```ts
import { ellipsePath } from '@weasel-js/geom';
import { extractPolylines } from '@weasel-js/geom/tessellate';

const ellipse = ellipsePath({ x: 0, y: 0, width: 200, height: 100 });

for (const line of extractPolylines(ellipse, { flattenTolerance: 0.25 })) {
  const { points, closed } = line;   // points is [x0, y0, x1, y1, ...]
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i], y = points[i + 1];
    // draw or measure the vertex
  }
  // when `closed`, the last point connects back to the first
}
```

The tolerance is the largest allowed gap between curve and segments, in the
path's own units. It defaults to `DEFAULT_FLATTEN_TOLERANCE`, 0.5, which suits
drawing at 1x zoom. A path shown zoomed in needs a smaller value, because the
gap is magnified along with everything else.

To flatten a single segment, call `flattenCubic` or `flattenQuadratic` with
the segment's points, a tolerance, and an output array. They append vertices to
the array and leave out the segment's start point, on the assumption that you
already pushed it as the end of the previous segment.

To place something a fraction of the way along a path, such as a label at the
middle of a connector, use
[pointAlongPath](#pkg/geom/reference/pointAlongPath). The fraction is measured
by length along the flattened shape, so 0.5 lands at the visual midpoint:

```ts
import { linePath, pointAlongPath } from '@weasel-js/geom';

const edge = linePath({ x: 0, y: 0 }, { x: 100, y: 0 });
const station = pointAlongPath(edge, 0.5);
// { point: { x: 50, y: 0 }, tangent: { x: 1, y: 0 } }
```

It returns `null` only for a path with no points. `tangent` is a unit vector
pointing toward the end of the path.

## Hit-test a point

A fill and a stroke are separate tests.

[pointInPath](#pkg/geom/reference/pointInPath) answers whether a point is in
the filled region. It honors the path's `fillRule`, so the hole of an
`'evenodd'` ring is outside.

[strokeHitTest](#pkg/geom/reference/strokeHitTest) answers whether a point is
within `threshold` of the outline. Pass half the stroke width to test against a
drawn stroke. It works on open and closed subpaths alike.

```ts
import { pathFromD, pointInPath, strokeHitTest } from '@weasel-js/geom';

const triangle = pathFromD('M0 0 L100 0 L50 80 Z');

pointInPath(triangle, 50, 20);        // true
pointInPath(triangle, 50, -3);        // false: above the top edge
strokeHitTest(triangle, 50, -3, 4);   // true: 3 units from the top edge

// A shape with both fill and stroke is hit by either.
const hit = pointInPath(triangle, 50, -3) || strokeHitTest(triangle, 50, -3, 4);
```

Both take a `tolerance` option, the flattening tolerance used for curved
segments.

A pointer's forgiveness is a distance on screen, not in the path's units. When
the path is drawn through a transform, pass that transform as `slop` and the
extra reach is measured in screen pixels, which stays correct when the
transform scales the two axes differently:

```ts
import { pathFromD, scale, strokeHitTest } from '@weasel-js/geom';

const line = pathFromD('M0 0 L100 0');
const toScreen = scale(4, 4);         // the path is drawn at 4x

// Hit within 6 screen pixels of a hairline: 1.5 path units at this zoom.
strokeHitTest(line, 50, 1, 0, { slop: { px: 6, transform: toScreen } }); // true
strokeHitTest(line, 50, 2, 0, { slop: { px: 6, transform: toScreen } }); // false
```

For selection by area, `pathContainsRect` and `pathIntersectsRect` test a path
against a `{ x, y, width, height }` rect, and `pathContainsPolygon`,
`pathIntersectsPolygon`, `polygonContainsPath`, and `polygonIntersectsPath` do
the same against a list of `{ x, y }` points, such as a lasso.

## Find the nearest point

`pathDistanceToPoint(path, x, y)` returns the distance from a point to the
path's outline. It ignores the fill: a point deep inside a shape still reports
its distance to the nearest edge. A path with no segments returns `Infinity`.

[nearestOnPath](#pkg/geom/reference/nearestOnPath) also says where that
nearest point is. It takes the two arrays of a `PolygonPath` and not the path
object:

```ts
import { nearestOnPath, pathDistanceToPoint, pathFromD } from '@weasel-js/geom';

const triangle = pathFromD('M0 0 L100 0 L50 80 Z');

pathDistanceToPoint(triangle, 50, -10); // 10

const nearest = nearestOnPath(triangle.commands, triangle.coords, 50, -10);
// { x: 50, y: 0, t: 0.5, dist: 10, commandIndex: 1, coordIndex: 2 }
```

`commandIndex` is the position in `commands` of the segment that holds the
point, and `t` is how far along that one segment it lies, from 0 to 1. A
closing `Z` counts as a segment. The result is `null` for a path with no
segments. To use it on a `RectPath`, build the same rectangle as a polygon with
`rectMarkerPath(x, y, width, height)` first.

When the question is which editable point is closest, convert the path with
`pathToAnchors` and use `nearestPathAnchor` or `nearestSegmentT`, which answer
in terms of anchors, the on-curve points a pen tool edits.

## Take a compound path apart

`splitSubpaths(path)` returns one `PolygonPath` per subpath. Each piece keeps
the original `fillRule`, so a hole split from its outer contour becomes a
filled shape of its own.

`splitByClosure(path)` returns `{ closed, open }`: the subpaths that end in
`Z` gathered into one path, and the rest into another. Either side is `null`
when it has no subpaths. `hasOpenSubpath(path)` answers the yes-or-no version
of the same question.

## Lay items along a path

`pathShape(path)` turns a path into a `TrackShape` (open or closed), over `measurePath` with its corners kept so a
heading does not blend across them. `trackRun(shape, from, to, { side })` reads a stretch of it as a run in reading
order; `side` is `'auto'` (whichever side is upright, the default), `'path'` (the path's own left side) or
`'flipped'`.

`placeAlongRun(run, lengths, options)` is the one placement primitive: item lengths in, a place for each out (its
center on the run, tip angle, and how far it is clipped past either end). Rows of controls in ui and core's text
effect both call it, so a new caller should too. `order: 'reading'` (default) lays items along the run's reading
order; `'track'` starts at the shape's own start. `runPlaces` and `runLength` are its helpers (2026-10-21).
