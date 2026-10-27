# @weasel-js/geom

The 2D geometry kernel the rest of weasel is built on: affine transforms, boxes,
Bezier math, the `Path` shape type and everything that operates on it, and
easing curves. It is plain functions over numbers and typed arrays, with no
DOM, no React, and no runtime dependencies in the root entry.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/geom).

## Install

```sh
npm install @weasel-js/geom
```

The `./tessellate` and `./warp` entries use the optional peer `earcut`, and `./booleans` uses
the optional peer `polygon-clipping`. Install a peer only if you import the
entry that needs it.

## Value types

Most functions take loose `x, y` numbers rather than point objects, so a hot
loop allocates nothing. The types that do exist are small:

| Type | Shape | Notes |
|---|---|---|
| `Mat3` | `[a, b, c, d, e, f]` | A 2D affine in canvas and `DOMMatrix` order: `x' = a·x + c·y + e`, `y' = b·x + d·y + f`. |
| `Box` | `[minX, minY, maxX, maxY]` | An axis-aligned box as a tuple. |
| `Rect` | `{ x, y, width, height }` | The same box in object form. |
| `View` | `{ x, y, scale: { x, y } }` | A viewport: the world point drawn at the canvas's top-left corner, and pixels per world unit on each axis. |
| `GlMat3` | nine-element `Float64Array` or `Float32Array` | The same affine laid out column-major for a WebGL `uniformMatrix3fv` upload. |
| `Path` | `RectPath \| PolygonPath` | A shape. See below. |

`translate`, `scale`, `rotate`, `rotateAboutPoint`, and `boxToBox` build a
`Mat3`. `multiply(m, n)` composes two, applying `n` first. `invert` returns
`null` for a singular matrix, and `applyToPoint` maps one point.

```ts
import { applyToPoint, invert, multiply, scale, translate } from '@weasel-js/geom';

// World to screen for a view at (10, 20), zoomed 2x: translate, then scale.
const worldToScreen = multiply(scale(2, 2), translate(-10, -20));
applyToPoint(worldToScreen, 15, 25); // [10, 10]

const screenToWorld = invert(worldToScreen); // Mat3 | null
```

The `mat3` namespace holds the `GlMat3` operations (`mat3.fromAffine`,
`mat3.toAffine`, `mat3.multiply`, `mat3.toUniform`, and others), and
`viewToMat3(view)` builds the world-to-screen `GlMat3` for a `View`.

## Paths

A `Path` is the shape type every weasel package shares. It is either:

- A `RectPath`, `{ kind: 'rect', x, y, width, height }`, for the common case of
  an axis-aligned rectangle.
- A `PolygonPath`, an SVG-style command stream: command codes (`M`, `L`, `C`,
  `Q`, `Z`) in a `Uint8Array`, their coordinates in a parallel `Float32Array`,
  and a `fillRule`. It covers polylines, polygons, Bezier outlines, and shapes
  with holes.

What operates on a path:

- **Building.** `PathBuilder` for move, line, curve, and close calls;
  `rectPath`, `polygonFromPoints`, `polylineFromPoints`, `ellipsePath`,
  `regularPolygonPath`, `starPath`, `linePath`, `circlePath`, and
  `roundRectPath` for common shapes; `pathFromD` to parse an SVG `d` string;
  `schneiderFit` to fit cubic curves through sampled points.
- **Measuring.** `boundsOfPath`, `unionBoundsPath`, `pathSignedArea`,
  `pointAlongPath`.
- **Transforming.** `translatePath`, `transformPath`, `scalePathToBounds`,
  `reversePath`.
- **Hit-testing.** `pointInPath` for the filled region, `strokeHitTest` for
  the outline, `pathContainsRect`, `pathIntersectsRect`, and the polygon
  variants for marquee and lasso selection, and `nearestOnPath` and
  `pathDistanceToPoint` for the closest point.
- **Editing.** `pathToAnchors` and `anchorsToPath` convert between the command
  stream and a list of anchors with control handles, the form a pen tool
  edits. `splitSubpaths` and `splitByClosure` take a compound path apart.
- **Constraining.** A `PathConstraint` holds anchors in a relation: fixed,
  horizontal, vertical, parallel, perpendicular, equal length, a set length,
  or coincident. `solvePathConstraints` moves a path's anchors the least that
  makes a list of them hold, and `constrainPathEdit` finishes an edit so they
  hold again: the anchors the edit moved stay put where they can, and a
  constraint that already failed before the edit is reported rather than
  solved.
- **Walking the stream.** `forEachSegment` visits each command with its
  coordinate offset and the pen position before it.

```ts
import {
  boundsOfPath, pathFromD, pointInPath, rotateAboutPoint, strokeHitTest, transformPath,
} from '@weasel-js/geom';

const triangle = pathFromD('M0 0 L100 0 L50 80 Z');

boundsOfPath(triangle);             // { kind: 'rect', x: 0, y: 0, width: 100, height: 80 }
pointInPath(triangle, 50, 20);      // true: inside the fill
strokeHitTest(triangle, 50, 3, 4);  // true: within 4 units of the outline

const turned = transformPath(triangle, rotateAboutPoint(50, 40, Math.PI / 2));
```

Below the path level, the curve functions work on one segment at a time:
`cubicEvalAt`, `splitCubicAt`, `cubicBounds`, `flattenCubic`,
`nearestOnCubic`, and their quadratic and line counterparts.

## Easings

An `EasingFn` maps progress `t` in 0..1 to eased progress. The package exports
the standard families by name (`easeOutCubic`, `easeInOutSine`,
`easeOutBounce`, and so on), the same set keyed by name in `EASINGS`, and
`cubicBezierEasing(x1, y1, x2, y2)` for CSS-style control points.

`EasingSpec` is an easing as a value that can be stored or serialized: a
function, a name, or `{ bezier: [x1, y1, x2, y2] }`. `resolveEasing` turns any
of them into the function.

```ts
import { resolveEasing } from '@weasel-js/geom';

const ease = resolveEasing('easeOutCubic');
ease(0.5); // 0.875

const custom = resolveEasing({ bezier: [0.4, 0, 0.2, 1] });
```

## Subpath entries

| Entry | What it adds | Optional peer |
|---|---|---|
| `@weasel-js/geom/curves` | Curve representations that read one shared anchor list and each produce a `PolygonPath`: `bezierCubic`, `bezierQuadratic`, `nurbs`, and `spiro`, also keyed by kind in `CURVE_REPS`. Each can evaluate a point and the curvature at a parameter. | none |
| `@weasel-js/geom/tessellate` | `tessellate` turns a path's fill into a triangle `Mesh` (vertices and indices). `extractPolylines` flattens each contour to straight segments, and `trimPolyline` shortens one from either end. | `earcut`, used by `tessellate` |
| `@weasel-js/geom/warp` | Warping paths: distorts (`bilinearQuad`, `projectiveQuad`), envelopes (`bicubicMesh`, `coonsMesh`), and puppets (`puppetMap`), each as a map of the plane and as `PathWarp` data a shape can hold and `applyPathWarp` remakes. A puppet triangulates the shape's fill (`puppetMesh`) and deforms it as-rigid-as-possible (`createArapSolver`), righting any triangle a hard pull turns over so the outline never folds back on itself; a `trace` option reads every stage of the solve. `warpPath` carries any map over a path and refits it as cubics. | `earcut`, used by puppets |
| `@weasel-js/geom/booleans` | Boolean operations on path fills: `pathUnion`, `pathIntersect`, `pathSubtract`, `pathExclude`, `pathDivide`, `pathCrop`, `pathTrim`, and `pathMerge`. Also cutting a path with a line or polyline: `splitPathBySegment`, `splitPathByPolyline`, `snipPathByPolyline`. | `polygon-clipping` |
| `@weasel-js/geom/3d` | The same kind of math one dimension up: `Vec3` and quaternion helpers, `Mat4` with `compose`, `perspective`, and `lookAt`, and ray intersection against planes and axis-aligned boxes. | none |
| `@weasel-js/geom/nd` | The port-curve rule over plain number arrays of any length: `portControls` returns the two cubic control points that make a curve leave one port along its normal and arrive against the next port's normal, and `portCurvePoints` samples that curve. | none |

The `./3d` entry reuses names from the root (`dot`, `scale`, `invert`,
`identity`), so import from one or the other, or alias at the import.

Boolean operations work on what a fill covers. Union, intersect, subtract,
exclude, divide, crop, trim, merge and the face pieces keep curves: each curve
in the result is a piece of an input curve, so the ellipse below comes back as
cubics. Inputs that are all straight lines, and the few cases the curve path
declines (outlines that coincide, a cubic that crosses itself), go through
`polygon-clipping` instead, with curves flattened.

```ts
import { ellipsePath, rectPath } from '@weasel-js/geom';
import { pathSubtract } from '@weasel-js/geom/booleans';

const plate = rectPath(0, 0, 100, 60);
const hole = ellipsePath({ x: 30, y: 10, width: 40, height: 40 });
const cut = pathSubtract(plate, hole); // the plate with the ellipse removed
```

## License

MIT
