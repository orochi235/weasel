# Pick index: a BVH broad phase for picks

**Unbuilt (2026-10-22).** Design for the `pick-index` branch. For whoever plans and builds it.
It answers how a pick stops testing every node in the scene, in 2D and in kernel3d.

## Why

Every pick walks `scene.renderOrderNodes()` start to finish (`pickWalk` in
`packages/core/src/canvas/pickWalk.ts`) and rejects node by node on bounds. A marquee over 10,000
rect nodes takes 3.59 ms, and the cost barely moves with the size of the marquee
(`tests/perf/bench/BASELINE.md`, `hitTestArea`): it is the scan, not the hits. Hover runs the
point version of the same walk on every pointer move. kernel3d's `createNodeAtPoint` and
`createAreaSelect` (`packages/kernel3d/src/deps.ts`) scan every node the same way.

## Goals

- A **BVH** (bounding volume hierarchy: a tree of nested boxes, one leaf per node) in
  `@weasel-js/geom`, generic over 2D and 3D, with box, point and ray queries.
- Core's pick walk visits only the nodes whose boxes the query's box meets, for area, lasso and
  point picks alike. Cost grows with the number of hits, not the size of the scene.
- kernel3d's ray pick and marquee use the same BVH in 3D.
- Results identical to today's walk: same ids, same back-to-front order.

## Non-goals

- Incremental, per-node index updates. See "Freshness".
- The other linear scans: `textHitAt`, `measureHit`, `slice`, diagram's `portLayer` and
  `labelDragLayer`, labkit's `lensHitBoxes`, `findPathSnaps`, kernel3d's snap `boxesOf`. They get
  TODO entries; most can move onto the same index once it exists.
- Changing what any pick returns. The index is a pre-filter: every gate and exact test the walk
  runs today still runs on what the index hands it.

## Anti-goals

- **A false negative.** A node the walk would have hit and the index dropped is a bug however
  rare. Every box the index stores must enclose everything the query's `hits` can accept for that
  node, and when that can't be guaranteed the node is tested the old way.
- A stale index answering for a scene that has changed.

## The BVH (`@weasel-js/geom`)

A new module (e.g. `geom/src/bvh/`), exported from the barrel and from `@weasel-js/geom/3d` where
the 3D queries live.

- Keyed by caller ids; boxes stored flat in a `Float64Array`, `2 × dim` numbers per box, `dim` 2 or 3.
- `build(entries)` from scratch (median or SAH split, builder's call), plus `insert`, `remove`,
  `update(id, box)` and `refit()` for callers that want them. Core uses only `build` (below);
  the rest are engine surface and get their own tests.
- Queries: `queryBox(box, visit)`, `queryPoint(p, visit)`, and in 3D `raycast(ray, visit)` that
  visits leaves nearest-first so a caller can stop at the first exact hit, plus a conservative
  frustum (or six-plane) box test for kernel3d's marquee.
- A box with a non-finite coordinate is refused at build and reported back, so the caller can test
  that entry the old way.

## Core: the index behind `scenePickSource`

**Where the walk changes.** `PickQuery` gains an optional broad-phase box: the region's bounds for
an area or lasso query, the point grown by its slop for a point query. `PickSource` gains an
optional `near(layer, box)` returning candidate ids. When both are present, `pickWalk` asks
`near` once per layer with that layer's query box (`queryFor(layer)` already gives the query in a
parallax layer's plane), adds the always-test list, reads the union out in render order, and runs
its existing loop over that list instead of `order()`. When either is absent, or the candidates
pass half the scene (where the index costs more than the walk), it walks `order()` as today.

**What gets indexed.** One tree per scene layer, since poses on a parallax layer are in that
layer's plane and the query is carried there per layer. Each node's box is the box `hits` tests
it against, before the exact test:
- a derived node: its derived path's bounds, never its placeholder pose
- otherwise `regionBoundsOf(node, pose, descriptor)` on the painted pose (`scenePaintedPoseOf`,
  world pose under a composing strategy)
- grown by the node's ink outset in world units (`findShapeInk(...).outset`)

The point query and the marquee test different boxes: the point query goes through
`poseContainsRotated` with the select tool's descriptor, and the marquee goes through
`regionBoundsOf` with `poseDescriptorForNode`. A stored box encloses both. The descriptor isn't
passed to `scenePickSource` today, so it has to be plumbed in.

Screen-pixel parts of the reach (`pickTolerancePx`, a `{ px }` stroke's `outsetPx`) can't be
stored in world units. The index records the largest `outsetPx` of any node, and a point query
grows its box by `(pickTolerancePx + maxOutsetPx) / scale`, using the smaller axis scale.

This depends on `NodeInk.outset` not changing with zoom, since zoom doesn't trigger a rebuild.
Decided 2026-10-22: the painter contract is tightened to say so. A reach measured in screen
pixels goes in `outsetPx`, never converted into `outset`. The `NodeInkCtx.scale` doc comment in
`canvas/nodeShapeTypes.ts` is changed to match, and the changeset prose states the tightening.
The built-in painters already comply (`inkReach` in `nodeShapes/nodePaint.ts`). The equivalence
test runs at several zoom levels.

**The always-test list.** Entries the index can't box conservatively bypass it and are tested on
every pick:
- every node with an ancestor that draws copies (`copiesFromPose`), since it is also hit where
  its copies are painted
- every node whose box is not finite
- containers whose hit test reaches past their own pose, if the builder finds any

**Order.** A `Map` from id to render index, rebuilt when `renderOrderNodes()` returns a new array.

**Freshness.** A pick keys the index on:
- `scene.getVersion()`
- `scene.overrides.getGeneration()`
- the node-memo generation (`bumpNodeMemoGeneration`), read after the built-in painters register
- the stroke-marker generation
- the descriptor identity

It is cached per scene in a `WeakMap`, one entry per descriptor. A pick that finds the key changed
walks the whole scene and only records the new key; the next pick that finds the same key builds
the index and uses it. So a scene edited before every pick (an animation, a drag that writes
overrides each frame) never builds and costs exactly today's walk, and a still scene pays one extra
walk after each change. Decided 2026-10-22, after a whole rebuild measured 14.6 ms at 10,000 nodes
against a 9-10 ms walk: building on the first pick made the animation case slower than today.
Rebuilding whole rather than incrementally is a call made in conversation (2026-10-22): an
incremental index has to follow overrides, derived poses and ancestor moves under composition,
and the scene reports changed ids for none of those (`scene.subscribe` carries no ids,
`onPoseWrite` covers pose writes only).

**Custom pose sources.** `scenePickSource` takes `getPose` (the point pick passes
`adapter.getWorldPose`). Before the index serves a source with a custom `getPose`, a test must
pin that this pose agrees with the one the index read for every node it boxed. A source whose
`getPose` can't be shown to agree doesn't get `near`.

**Bare adapters.** `adapterPickSource` has no scene versions to key on and stays a full walk.

## kernel3d

`createNodeAtPoint` casts its ray through a 3D BVH of `boundsOfNode(world, node)` and keeps the
nearest exact hit. `createAreaSelect` keeps its exact `screenBoxOf` test, but runs it only on the
nodes the BVH's frustum test admits for the screen rect. Both keep today's results and order.
Where two nodes are equally near, the ray pick keeps today's winner: the first in render order.
The index is cached per world, keyed on `scene.getVersion()`, the overrides generation and the
identity of `world.bounds`. `world.bounds` is documented as a function of the node. Its doc
comment changes to say a result that depends on anything else must come with a scene change, or
the pick is stale.

## Verification

- Equivalence: for each existing pick test fixture and for randomized scenes (rotated poses,
  derived nodes, clips, containers, copies, parallax layers, overrides), the indexed walk returns
  exactly what the unindexed walk does. Kept as a permanent test that runs both paths.
- Staleness: a pose op, an override commit, a data change that alters bounds, a reparent and a
  painter registration each move a node, and the next pick finds it in its new place.
- Benchmarks: `hit-test.bench.ts` with and without the index, a new point-pick bench, and a
  bench of the rebuild alone. Raw runs go under `tests/perf/recorded/`, and `BASELINE.md`'s
  hit-test rows are re-recorded.
- kernel3d: the same equivalence check on `nodeAtPoint` and `hitTestArea`.

## Left to the builder

- The tree's split heuristic, leaf size and memory layout.
- Whether `near` returns ids or candidates, and where the per-layer query box is computed.
- Whether a scene too small to profit (some tens of nodes) skips the index. Measure before deciding.

## To check while building

The area query's `hits` takes `(node, pose)` and drops `derived` (`hitTestArea.ts`, `walkArea`),
while the point query uses it. If marquee does test a derived node against its placeholder pose,
fix it in its own commit first. The index boxes derived nodes by their path, so leaving the bug in
would make the index and the exact test disagree.
