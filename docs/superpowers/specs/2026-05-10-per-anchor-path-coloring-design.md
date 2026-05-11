# Per-anchor path coloring (fill + stroke)

**Status:** design
**Date:** 2026-05-10

## Background

The renderer ships a fill-side per-vertex color path: `PathDrawCommand.vertexColors` is a flat RGBA array consumed by the `pathFillVColor` shader, currently interpreted as RGBA-per-mesh-vertex. Two demos (`VertexColorsDemo`, `PerceptualColorSlidersDemo`) consume it directly by writing a custom `RenderLayer` that emits `PathDrawCommand` themselves. There is no public layer hook, and the per-mesh-vertex semantic is leaky — for paths with bezier commands the mesh vertex count depends on the renderer's flattening tolerance, which consumers can't predict.

Strokes have no per-vertex color path at all: `drawPathStrokeUnclipped` and `drawPathStrokeStenciled` both bind a single `u_color` uniform against a ribbon mesh from `tessellateStroke`.

This spec unifies the two sides under one consumer model — **per-anchor coloring, arc-length interpolated** — and exposes it through `createPathLayer` so vertex-colored fills and strokes become first-class scene-object styling, parallel to `getFill` / `getStroke`.

## Goals

- Add a public layer surface for per-vertex coloring on path fills and strokes.
- Redefine the public color contract as **per path anchor** (M / L / C / Q destination points), with the renderer arc-length-interpolating across flattened/tessellated geometry. Decouples consumers from internal vertex counts.
- Validate color array length against anchor count in dev; warn and drop on mismatch.
- Demonstrate the fill surface (`VertexColorsDemo` refactor) and the stroke surface (rainbow hues on the `BezierEditDemo` S-curve).
- Update the TODO entry to reflect that per-vertex coloring is now public for both fills and strokes.

## Non-goals

- **Raw per-mesh-vertex public surface.** Consumers who want vertex-level control (procedural textures, etc.) write a custom `ShaderDrawCommand`. The standard `PathDrawCommand` color contract is per-anchor.
- **Per-vertex coloring for gradient or pattern fills.** Vertex colors only apply when the fill (or stroke paint) would otherwise be solid. The renderer's vColor shader path already requires a solid fill placeholder; we keep that.
- **Animation primitive integration.** Tweening / springing over a color array is a natural follow-up but out of scope here.
- **Cross-tool coordination.** No interaction with selection-overlay drawing or chrome — colors are a pure render-side concern.

## Surface additions

### `Stroke.vertexColors`

```ts
export interface Stroke {
  paint: Paint;
  width?: number;
  dash?: number[];
  cap?: 'butt' | 'round' | 'square';
  join?: 'miter' | 'round' | 'bevel';
  align?: StrokeAlign;
  /** Per-anchor RGBA (flat, length = 4 × countPathAnchors(path)). Arc-length
   *  interpolated across the tessellated ribbon. `paint` still required —
   *  its `opacity` (and color, as a placeholder) flows through the shader. */
  vertexColors?: number[];
}
```

Colors live on `Stroke` because strokes are paint, and `Stroke` already aggregates per-stroke style (width, dash, cap, join, align). Adding `vertexColors` here keeps "everything about how this stroke draws" in one record.

### `PathDrawCommand.vertexColors` semantic shift

Field stays where it is. Documentation flips from "RGBA-per-mesh-vertex" to "RGBA-per-path-anchor (M/L/C/Q destinations)." For polygon-only paths (no `PATH_C`/`PATH_Q` commands) anchor count equals mesh vertex count, so existing renderer consumers (the two demos that bypass `createPathLayer`) continue to work unchanged. For curves the renderer now interpolates instead of assuming the caller knew the mesh count.

The "fill must be set" requirement stays. The doc gains:

> Length must be `4 × countPathAnchors(path)`. The renderer expands to per-mesh-vertex colors via arc-length interpolation along the flattened geometry between consecutive anchors.

### `createPathLayer` hooks

```ts
interface CreatePathLayerOpts<T> {
  // ...existing
  getVertexColors?: (node: T) => number[] | null | undefined;
  getStrokeVertexColors?: (node: T) => number[] | null | undefined;
}
```

Each is independent — a node can have colored fill, colored stroke, both, or neither. Length expectation: `4 × countPathAnchors(getPath(node))` (same for both).

**Fill placeholder.** When `getVertexColors(node)` returns non-null and `getFill(node)` returns null/undefined, the layer synthesizes `{ color: '#ffffff' }` so the renderer's fill-required gate passes. If `getFill` returns a Paint, that wins (lets consumers control opacity via `Paint.opacity`).

**Stroke placeholder.** When `getStrokeVertexColors(node)` returns non-null and `getStroke(node)` returns null/undefined, the layer synthesizes `{ paint: { color: '#ffffff' }, width: 1 }`. If `getStroke` returns a Stroke, the layer threads the colors onto `Stroke.vertexColors`. The hook is authoritative: if the returned Stroke already had a `vertexColors` field, the hook's value overrides it (consumers should pick one path or the other, not both).

### `countPathAnchors(path)`

New public helper, exported from `src/features/paths/index.ts` and re-exported through the main barrel.

```ts
export function countPathAnchors(path: Path): number;
```

- `RectPath` → `4` (the four corners; matches the M + L + L + L + Z command sequence the renderer uses internally for rect stroke tessellation).
- `PolygonPath` → number of M + L + C + Q commands. Z takes none (closes back to the subpath's first anchor).

Consumers use it to size their color arrays. Anchor index assignment is in command-stream order, across all subpaths.

## Renderer changes

### Mesh build (fill side)

After flattening curves to a polyline and running earcut, the mesh's vertex array consists entirely of boundary points (earcut adds no Steiner points). For each mesh vertex the build pass:

1. Identifies which path anchor pair `(a, b)` the vertex lies between on the flattened polyline. Two pieces of bookkeeping:
   - The flattener emits an `anchorIndex: Uint32Array` alongside the flattened-point buffer, recording which anchor each flattened point "belongs to" (the anchor it was emitted from or interpolated toward).
   - Earcut preserves the input ring's vertex order in its output indices, so each output mesh vertex maps back to a flattened-point index.
2. Computes `t` = arc-length fraction along the flattened polyline between anchor `a` and anchor `b`. Stored as three parallel buffers on the mesh:
   - `anchorA: Uint32Array(meshVertexCount)`
   - `anchorB: Uint32Array(meshVertexCount)`
   - `anchorT: Float32Array(meshVertexCount)`

The parameterization is cached on the mesh handle (same identity-based `WeakMap` as the mesh itself) — it lives or dies with the mesh.

### `drawPathFillVColor`

Today: uploads `cmd.vertexColors` directly as the color VBO. New: when colors are present, walk the cached parameterization and expand `4 × anchorCount` floats into `4 × meshVertexCount` floats via per-vertex lerp:

```
out[v] = lerp(anchorColors[a[v]], anchorColors[b[v]], t[v])
```

Upload the expanded array (existing freshly-allocated-per-draw VBO, freed at end of call). No shader change — `pathFillVColor` still reads `a_vertexColor` per mesh vertex.

CPU expansion is a deliberate choice for v1: simpler than uploading two color attributes + t and lerping in the shader; perf is fine because expansion is `O(meshVertexCount)` and runs only when colors are present.

### Stroke tessellation

`tessellateStroke(path, stroke)` today returns `{ positions, indices }`. New: it also emits parameterization for each ribbon vertex:

```ts
interface StrokeMesh {
  positions: Float32Array;
  indices: Uint32Array;
  anchorParam?: Float32Array; // length = 2 × ribbonVertexCount: packed (a, b, t)
}
```

Built only when `stroke.vertexColors` is provided on the call. `tessellateStroke` gains a fourth argument (`opts: { anchorParam?: boolean }`) so the caller controls the extra work; `drawPathStrokeUnclipped` / `drawPathStrokeStenciled` pass `anchorParam: true` exactly when `cmd.stroke.vertexColors` is set. For each ribbon vertex the tessellator records:

- Vertices clustered at an anchor (cap geometry, join geometry, dash boundaries that happen to land on anchors) get `(a, a, 0)` → exact anchor color.
- Vertices along a segment between anchors `a` and `b` get arc-length fraction `t` along that segment.

Dash gaps don't introduce color anchors — dashed strokes drop ribbon vertices in the off intervals but the on intervals retain their underlying arc-length positions, so the same `(a, b, t)` lookup applies.

### `drawPathStrokeUnclipped` / `drawPathStrokeStenciled`

Today: `useProgram(ctx.pathFill)`, set `u_color`, draw. New: if `stroke.vertexColors` is set, route to `pathFillVColor` instead (the same shader the fill side uses — it's geometry-agnostic). CPU-expand `anchorCount × 4` floats into `ribbonVertexCount × 4` via the cached `anchorParam`, upload, draw.

For the stenciled path (inner/outer stroke align on polygon paths), the color expansion is on the ribbon mesh; the stencil is built from the fill mesh and is unchanged. So colors still flow through cleanly.

## Validation

In `createPathLayer`, when either hook returns non-null, check `colors.length === 4 × countPathAnchors(path)`. On mismatch:

- Dev (`import.meta.env?.DEV`): `console.warn` once per `(layer-id, node-id)` pair with the expected vs received count. Drop the colors for that node — emit the DrawCommand without `vertexColors` / `stroke.vertexColors`.
- Prod: silently drop the colors. No warn, no overhead.

Warning is once-per-pair (not per frame) to avoid log spam during interaction. A `Set<string>` keyed by `${layerId}:${nodeId}` is fine; cleared when the layer is rebuilt.

## Demo changes

### `VertexColorsDemo` refactor

The demo currently emits a custom `RenderLayer`:

```ts
const layer: RenderLayer<unknown> = useMemo(() => ({
  id: 'vertex-colored-poly',
  draw: (_data, view) => {
    const path = polygonFromPoints(verts.map((v) => ({ x: v.x, y: v.y })));
    const colors = verts.flatMap((v) => v.rgba);
    return [{ kind: 'group', transform: viewToMat3(view), children: [
      { kind: 'path', path, fill: { color: '#ffffff' }, vertexColors: colors }
    ] }];
  },
}), [verts]);
```

After refactor: model the heptagon as a scene node and use `createPathLayer`:

```ts
const layer = useMemo(() => createPathLayer<HeptagonNode>({
  id: 'vertex-colored-poly',
  getNodes: () => [heptagon],
  getPath: (n) => n.path,
  getVertexColors: (n) => n.colors,
}), [heptagon]);
```

Where `heptagon` is a `{ path, colors }` record derived from `verts`. The `fill: '#ffffff'` placeholder vanishes — `createPathLayer` synthesizes it. The custom-RenderLayer import drops; only kit primitives remain in the demo. The handle/SVG overlay machinery is unchanged.

`PerceptualColorSlidersDemo` stays as-is (its custom layer also draws non-path chrome — dashed range tracks — that doesn't belong in `createPathLayer`). It remains the kit's "compose other geometry with vColor paths" example.

### `BezierEditDemo` rainbow

The demo renders an open S-curve as a stroke (`stroke: { paint: { color: '#f5b7a3' }, width: 2 }`). Both the scene-layer's `drawOne` and the move-ghost's `drawGhost` emit this.

Update both call sites: compute a rainbow color array sized to the path's anchor count, attach as `stroke.vertexColors`:

```ts
const N = countPathAnchors(p);
const colors = rainbowColors(N); // flat RGBA, length 4 × N
const cmd: DrawCommand = {
  kind: 'path',
  path: p,
  stroke: { paint: { color: '#ffffff' }, width: 2, vertexColors: colors },
};
```

`rainbowColors(N)`: `hsl(360 × i / N, 80%, 60%)` → RGBA per anchor, defined inline in the demo (not promoted to the kit). The "Add point" button automatically distributes hues across the new anchor count because the array is recomputed per-render.

The "show handles" / zoom controls / selection / anchor-edit gestures are unchanged. The demo gains a visual signal that anchor count actually changed and that the kit knows how to interpolate colors across curves (the ribbon's hue gradient continues smoothly through each cubic segment).

## TODO entry update

The Tier 1 entry currently reads:

> **Per-vertex coloring on paths.** Renderer-side shipped, public surface deferred. Step 5 added `PathDrawCommand.vertexColors?: number[]` ... What's missing on the public side: a Path-pose attribute (`Path.vertexColors`) that flows through `createPathLayer` automatically, plus `PoseDescriptor` interaction so resize/move don't drop the colors.

After this work ships, replace with:

> **Per-anchor coloring on paths.** *Shipped.* `createPathLayer` exposes `getVertexColors` (fill) and `getStrokeVertexColors` (stroke); `Stroke.vertexColors` and `PathDrawCommand.vertexColors` carry per-anchor RGBA arrays. The renderer arc-length-interpolates across flattened/tessellated geometry. `countPathAnchors(path)` sizes the array. Two demos in the kit: `VertexColorsDemo` (fill) and `BezierEditDemo` (rainbow stroke on the editable S-curve). Open follow-up: animation primitive integration (tween/spring over a color array) for things like color cycling along the stroke.

(Note that the original entry's "Path-pose attribute" framing was reconsidered — colors are paint, not pose, and live on `Stroke` / `PathDrawCommand` accordingly.)

## File-level changes

- `src/features/paths/index.ts` — re-export `countPathAnchors`.
- `src/features/paths/anchors.ts` — new file: `countPathAnchors` implementation + unit test next to it.
- `src/features/paths/pathLayer.ts` — add the two hooks, the placeholder synthesis, and the dev validation.
- `src/features/paths/pathLayer.test.ts` — extend with coverage for both hooks: anchor-count validation, placeholder synthesis, both-hooks-set composition.
- `src/features/paths/tessellate/stroke.ts` — emit `anchorParam` when colors are requested. Unit test for cap/join `t = 0|1` boundaries and inter-segment `t` monotonicity.
- `src/features/paths/tessellate/flatten.ts` (or equivalent fill flattener) — emit `anchorIndex` alongside flattened points so the mesh build can derive `(a, b, t)`. Unit test for curves and multi-contour paths.
- `src/renderer/draw.ts` — CPU expansion in `drawPathFillVColor`; new vColor routing in `drawPathStrokeUnclipped` + `drawPathStrokeStenciled`.
- `src/renderer/DrawCommand.ts` — doc update on `PathDrawCommand.vertexColors`.
- `src/core/paint-types.ts` — add `Stroke.vertexColors`.
- `src/index.ts` — re-export `countPathAnchors`.
- `demo/demos/VertexColorsDemo.tsx` — refactor to use `createPathLayer`.
- `demo/demos/BezierEditDemo.tsx` — rainbow stroke via `countPathAnchors` + `getStrokeVertexColors` (or equivalent inline since the demo uses an explicit adapter, not `createPathLayer`).
- `docs/TODO.md` — replace the entry per "TODO entry update" above.

## Open questions

- **Closed-path stroke wraparound.** For a closed path with N anchors, the last segment runs from anchor N-1 back to anchor 0. The natural interpretation is that the last segment lerps `anchorColors[N-1] → anchorColors[0]`, matching how the fill case handles closed contours via earcut. Verify this is what `tessellateStroke` produces for a closed input before locking it in. (Probably fine; flagging because the wraparound is the most likely source of off-by-one.)
- **Multi-contour stroke colors.** A path with two subpaths exposes a single flat color array. The natural mapping is "anchors in command-stream order, both subpaths." But the user-facing question is whether crossing the subpath boundary (from the last anchor of subpath 1 to the first anchor of subpath 2) should interpolate or be a hard cut. Each subpath's stroke is its own polyline — there's no visible geometry connecting them — so the question only matters for the color array indexing, not rendering. Decision: subpaths are independent; the color array is flat with all anchors in order; no interpolation occurs across the gap because there are no ribbon vertices to interpolate. Confirm during implementation that `tessellateStroke`'s `anchorParam` doesn't accidentally bridge subpaths.

## Risks

- **`tessellateStroke` complexity.** Cap/join geometry adds vertices around corners; getting their `(a, b, t)` right (especially miter joins that extrude beyond the corner) needs careful threading. Mitigated by anchoring corner-adjacent vertices to the corner anchor itself with `t = 0`.
- **Mesh-handle invalidation.** The parameterization caches per mesh; if the existing cache eviction doesn't re-emit it when geometry changes, colors will sit on stale arc-length data. Verify the parameterization rebuild rides the existing mesh-cache miss path.
- **Performance regression for non-colored strokes.** Adding an `anchorParam` field shouldn't slow the existing solid-stroke path. The build conditionally emits it — solid strokes pay zero cost. The draw path branches on `stroke.vertexColors` before doing any expansion work.
