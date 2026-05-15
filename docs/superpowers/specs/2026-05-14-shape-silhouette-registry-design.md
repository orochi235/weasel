# Shape silhouette registry — design

Date: 2026-05-14
Status: design, awaiting plan.

## Goal

Stop making consumers hand-roll a pose→Path function every time they
want a non-rect shape to participate in clipping (and, downstream,
hit-testing, area-select, SVG export). Lift the "how do I derive
this kind of node's silhouette from its pose?" question into the
existing shape registry so consumers register a kind of shape once
and clipping/lasso/export all consult the same source.

More broadly: reframe `shapePainters` from a paint-dispatch table
into a **shape-kind extension point**. `paint` and `silhouette` are
the kit-standardized methods (because the kit has cross-cutting
uses for them); consumers attach whatever else their domain needs
to the same painter object and call it directly. The kit doesn't
try to anticipate every shape-specific operation a consumer might
want — it just makes sure the painter is the single, discoverable
home for shape-kind behavior.

## Motivation

The clipping demo today wires an ellipse like this:

```ts
function ellipsePath(pose: Pose, segments = 48): Path { /* 10 lines */ }

const scene = sceneFromJSON(json, {
  registry: { clipFromPose: { ellipse: ellipsePath } },
});
```

That `ellipsePath` is generic, not demo-specific. Any consumer that
wants an elliptical container clip writes the same function. Any
consumer that wants ellipse hit-testing, ellipse area-select, or
ellipse SVG export writes a *different* function with the same
geometry, in a different layer of the stack, because there's no
shared seam for "shape kind → silhouette path".

What the kit already has:

- **`shapePainters`** (`src/canvas/shapePainters.ts`) — pluggable
  registry of `ShapePainter { id, matches, paint }`. The dispatch
  side of "what kind of node is this and what do I do with it" is
  already centralized.
- **`ContainerNode.clipFromPose`** (`src/core/scene/types.ts:81`)
  — per-node optional function. Plumbed through `SceneRegistry`
  for serialization (a string `clipFromPoseKey` resolves to a live
  function on load).
- **`pathPoseDescriptor`** — for `pose IS a Path` nodes, used by
  `useResize`/hit-testing/etc. via the optional `geometry` opt.

What's missing is the bridge: a painter knows it's an ellipse
(`matches`), but no other system can ask it for the ellipse's path.

## Proposal

Extend `ShapePainter` with one optional method:

```ts
export interface ShapePainter<TData = unknown, TPose = unknown> {
  id: string;
  matches(node: Node<TData, string, TPose>): boolean;
  paint(node: Node<TData, string, TPose>, pose: TPose): DrawCommand[];

  /** Optional: derive the node's silhouette path from its pose.
   *  Used by clipping (when the container has no explicit
   *  `clipFromPose`), by non-rect hit-testing, by lasso/area-select,
   *  and by SVG export. Painters whose visual has no meaningful
   *  closed silhouette (e.g. text) leave this undefined. */
  silhouette?(node: Node<TData, string, TPose>, pose: TPose): Path | null;
}
```

Add a single dispatch helper:

```ts
export function findShapeSilhouette<TData, TPose>(
  node: Node<TData, string, TPose>,
  pose: TPose,
): Path | null {
  const painter = findShapePainter(node);
  return painter?.silhouette?.(node, pose) ?? null;
}
```

### Clipping integration

In the renderer's container-clip path (and the clip-aware hit-test
in `useSelectTool`):

```ts
// today
const ownClip = typeof node.clipFromPose === 'function'
  ? node.clipFromPose(pose)
  : null;

// after
const ownClip = typeof node.clipFromPose === 'function'
  ? node.clipFromPose(pose)
  : findShapeSilhouette(node, pose);
```

Explicit per-node `clipFromPose` still wins — it's the escape hatch
for "I want the container clipped to a shape that isn't its visual
silhouette." The default behavior changes from "rect, always" to
"whatever this kind of node draws as." That matches the intuition
every demo consumer has reached for.

### Built-in painters

Update `RECT_FALLBACK_PAINTER` to set `silhouette` returning the
node's rect path. `PATH_PAINTER` returns `node.data.path`.
`TEXT_PAINTER` leaves `silhouette` undefined.

### Consumer ergonomics

The clipping demo collapses to:

```ts
registerShapePainter({
  id: 'demo:ellipse',
  matches: (n) => (n.data as { shape?: string }).shape === 'ellipse',
  paint: (n, pose) => [/* ellipse draw command */],
  silhouette: (_n, pose) => ellipsePath(pose),
});

const scene = sceneFromJSON(json); // no per-scene registry needed
```

The per-scene `SceneRegistry.clipFromPose` plumbing stays for the
escape-hatch case (per-node custom clips that diverge from the
visual silhouette) but stops being the *only* way to make a non-rect
container clip work.

### Shape-specific extension (consumer-defined methods)

`silhouette` covers the cross-cutting cases the kit needs (clip,
generic hit-test, lasso, SVG fallback) but it's a coarse summary
of a shape — a closed-ish boundary. Consumers building richer
shapes will need shape-aware operations the kit can't anticipate.

The painter object itself is the extension point. A consumer
registers a painter with whatever methods their tools need, then
their tools fetch the painter via `findShapePainter(node)` and
call those methods directly. The kit only sees `paint` and
`silhouette`; the rest is private to the consumer.

Example — a gear painter the consumer wires into their own
sketch tool:

```ts
interface GearPainter extends ShapePainter<GearData, RectPose> {
  /** Number of teeth and pitch radius derived from the gear's data. */
  toothAngles(node: Node<GearData, string, RectPose>): number[];
  /** Hit zone the cursor is over: 'tooth' (with index), 'hub', or null. */
  hitZone(
    node: Node<GearData, string, RectPose>,
    pose: RectPose,
    point: { x: number; y: number },
  ): { kind: 'tooth'; index: number } | { kind: 'hub' } | null;
}

const GEAR_PAINTER: GearPainter = {
  id: 'app:gear',
  matches: (n) => (n.data as GearData)?.kind === 'gear',
  paint: (n, pose) => [/* draw teeth + hub commands */],
  silhouette: (n, pose) => gearOutline(n.data, pose),
  toothAngles: (n) => evenAngles(n.data.toothCount),
  hitZone: (n, pose, p) => /* center-distance vs pitch radius, then nearest tooth */,
};

registerShapePainter(GEAR_PAINTER);

// In the consumer's gear-edit tool:
const painter = findShapePainter(node) as GearPainter | undefined;
const zone = painter?.hitZone(node, pose, worldPoint);
if (zone?.kind === 'tooth') /* highlight that tooth */;
```

The kit still uses `silhouette` for clipping the gear's contents,
generic body-hit, lasso intersection, and SVG export — those *all
work without the gear painter changing the kit*. The gear-edit
tool's tooth-aware behavior is layered on top by reaching into the
painter for methods only the consumer's tools know to call.

This is the pattern, not a new API. The spec only commits the kit
to standardizing `paint` and `silhouette`; everything else is
consumer territory by convention.

## Knock-on uses

Same registry feeds, by follow-up:

1. **Non-rect hit-testing.** `useSelectTool`'s default body-hit
   uses the AABB. Where a painter provides `silhouette`, the
   selection tool can `pointInPath` against that instead. Removes
   the "click corner of an ellipse and somehow grab it" wart.
2. **Area-select / lasso.** `selectFromLasso` already calls
   `polygonIntersectsRect` against the node's AABB. With
   `silhouette`, it can run the real polygon/polygon test.
3. **SVG export.** `packages/weasel-svg` currently emits each
   node as a `<rect>` or via `node.data.path`. With `silhouette`
   it can emit a `<path d=...>` for ellipses, polygons, etc.,
   without each shape kind teaching the exporter separately.

These are *future* — the spec scopes to the registry extension
and the clipping integration only. The other three are listed so
the API shape is judged against where it's heading.

## Tradeoffs

**Why not a parallel registry (`shapeSilhouettes`)?** Painter and
silhouette are the same concept's two sides — most consumers will
define them together. Two registrations per shape kind is friction
without payoff. The optional method on `ShapePainter` lets text
opt out cleanly (no silhouette to register) and keeps the lookup
path single-pass.

**Why optional?** Some painters genuinely have no silhouette
(text, arbitrary multi-pass effects). Forcing a return value
would push consumers to invent garbage.

**Backwards compat.** No breaking changes:
- `ContainerNode.clipFromPose` still works and still wins.
- `SceneRegistry.clipFromPose` still works.
- Built-in painters gain `silhouette` (rect/path); existing
  consumers with custom painters lacking `silhouette` keep
  rendering unchanged — clipping behavior in their case is
  identical to today (no silhouette → fall back to whatever
  the per-node `clipFromPose` returns, possibly null).

**Demo cleanup.** The clipping demo's `ellipsePath` and the
`registry.clipFromPose` plumbing collapse. Optionally, ship a
`registerEllipsePainter()` helper in the kit so the demo doesn't
need its own painter — but that's a separate decision (the kit
has so far refused to ship "shape kinds" beyond rect/path/text).

## Out of scope

- Whether the kit ships built-in painters for ellipse, polygon,
  star, line. (`useShapeTools` exists but produces nodes with
  `data.path` — those work with `PATH_PAINTER` today.)
- Hit-test / area-select integration (called out as knock-on uses,
  not delivered here).
- SVG export integration (ditto).
- A `bounds(node, pose)` method on the painter. Bounds are
  currently a different seam (`pathPoseDescriptor.boundsOf`,
  AABBs from rect pose); unifying them is a separate spec.

## Migration

1. Add the optional `silhouette` field to `ShapePainter`.
2. Add `findShapeSilhouette` next to `findShapePainter`.
3. Set `silhouette` on `PATH_PAINTER` and `RECT_FALLBACK_PAINTER`.
4. Wire the renderer's container-clip path to fall back to
   `findShapeSilhouette` when `node.clipFromPose` is absent.
5. Wire `useSelectTool`'s clip-aware hit-test (same fallback).
6. Update the clipping demo to register an ellipse painter with
   both `paint` and `silhouette`; drop the `clipFromPose` registry
   entry from `sceneFromJSON`.
7. Visual regression: clipping demo baseline should be unchanged.

No data migration. No serialization format change. Existing scenes
with `clipFromPoseKey` in their JSON keep loading as today.
