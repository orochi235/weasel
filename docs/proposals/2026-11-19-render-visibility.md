# Render-time visibility

**Status: designed 2026-11-19, unbuilt.** Arc 1 of the scale arcs (`docs/TODO.md`, "Scale"); its
entry and closing condition are in `docs/PERF.md` ("A frame walks every node"). For whoever builds
it, and for the arcs after it, which assume what this provides.

## The problem

A frame's cost grows with the whole scene, not with what is on screen.

- `buildSceneViewCommands` (`packages/core/src/canvas/sceneViewRender.ts`) builds the whole
  hierarchy and hands `buildSceneTree` a `culled` predicate. A culled node skips only its own
  painter: its clip still extends the chain, its children are still visited, and every node still
  emits a wrapper group (`buildSceneTree.ts`, `visit`).
- `cullDrawCommands` then makes a second linear pass over the commands.
- The one spatial index, `scenePickIndex` (a BVH per layer over node broad boxes), serves picking
  only. It learns of a change by finding the scene's version moved, and rebuilds whole once the
  scene settles (`SettledCache`), because the scene says *that* it changed, never *what*.

## What it adds

Four pieces, each usable alone, built in this order.

### 1. A touched-ids feed on the scene

The foundation the rest stands on. Every kit op already names the nodes it changes; the scene
records them. `scene.changesSince(token)` answers the ids touched since `token` and whether the
change was structural (an add, remove, reparent, reorder, or layer change), or `'unknown'` when the
journal no longer reaches back that far. The journal is bounded (a ring of a few thousand entries);
a reader that falls off it rebuilds, exactly as the pick index does today.

What counts as touching a node, beyond its own ops:
- the nodes that derive from it (`sceneDependentsOf`), since a derived path moves with its sources;
- its descendants, when a change to it reaches them: an inherited fill or stroke
  (`inheritedPaint.ts`), or a frame it defines under a composing `PoseComposition`;
- pose overrides: `scene.overrides` records the ids it sets or clears, so a drag touches one
  node a frame.

Ambient state with a generation (`nodeMemoGeneration`, `markerGeneration`, `outsideGeneration`,
fonts) answers `'unknown'`. Those change rarely, and a full rebuild is the honest answer.

The render worker's `sceneDiff` and the pick index both read this feed in place of a version
check, so the scene answers "what changed" once.

### 2. Reach boxes: subtree pruning

Each node keeps two boxes in world space:
- **own:** where its paint can reach, from the same `paintBounds` the cull uses today
  (`sceneCullPaintBounds`), at its drawn pose. A node `paintBounds` cannot bound gets an unbounded
  box and is never pruned, as it is never culled today.
- **reach:** own ∪ each child's reach ∪ each child's reach under every `copiesFromPose` affine.
  A clipped container may intersect its children's reach with its clip's bounds.

A touched id dirties its own box and the reach of each ancestor (O(depth)). Boxes recompute lazily,
bottom up along dirty chains, when a frame asks.

Parallax: a layer with `parallax` is seen through its own plane view. A reach also carries the set
of parallax planes its subtree paints on (a bitset over the scene's layers). A subtree is pruned only
when its reach misses the view of every plane in that set.

`buildSceneTree` takes the index in place of `culled`. A subtree whose reach misses is not visited
at all: no painter, no clip chain, and no wrapper group. The wrapper groups exist for `pickId` (the
GPU id pass) and for a stable tree shape. An off-screen node cannot be picked on screen. Before this
merges, check that nothing reads the shape, by grepping the retained and diff paths for consumers.

### 3. A wide-sibling index: flat scenes

Pruning does nothing for 100k nodes under one layer root, which is the common case. A parent whose
child count passes a threshold (start at 64; measure) keeps a BVH over its children's reach
(`createBvh` from `@weasel-js/geom/nd`, which already has `insert`, `update`, `remove` and `refit`).
A touched child updates its entry, and a structural touch to the parent rebuilds that parent's tree
alone. The walk asks the BVH which children's reach meets the view and visits those, sorted back
into sibling order, so the paint order is unchanged. That costs O(k log k) for k visible.

### 4. One engine, two box functions, and 3D

The maintenance (feed, dirty chains, lazy recompute, per-parent BVHs) is one engine, generic over
dimension and over the box function:

| Index | Box | Query |
|---|---|---|
| render visibility | paint reach | the view as half-spaces: 4 for a 2D view and screen rect, 6 for a 3D frustum (`queryHalfSpaces`) |
| scene pick | `nodeBroadBox` | a point, or a rect plus slop |
| kernel3d pick | its 3D box | a ray |

`scenePickIndex` moves onto it, so a drag stops rebuilding the pick index after it settles.
kernel3d's pick index (`packages/kernel3d/src/pickIndex.ts`) can move too. A 3D host renderer
queries visibility with its frustum's planes. Nothing in the engine is `{x, y}`: boxes are
`Float64Array` `[min…, max…]` of the index's dimension.

## How it's measured

A spec in `tests/perf/`, run on the fleet as a perf job (not a test run), on two scenes: 100k rect
nodes flat under one layer, and 100k under a 10×10×1000 group nesting. Each frame shows about 1%
of the nodes. The time of each frame is compared with the same visible 1k drawn as a scene alone.
The entry closes at within 2× for both, with one node dragged for 300 frames costing no rebuild
(build counts pinned the way `pickIndexBuildCount` pins them today). Each run's raw frame times go
to disk, per the repo's measurement rules.

## Order of work

1. The touched-ids feed, with tests for each source of a touch (ops, dependents, inherited paint,
   frames, overrides, ambient generations answering `'unknown'`).
2. Reach boxes and subtree pruning in `buildSceneTree`, measured on the nested scene.
3. The wide-sibling BVH, measured on the flat scene.
4. The pick index onto the engine; the render worker's diff onto the feed.
5. The half-space query for 3D and a kernel3d consumer.
6. The perf spec, and the PERF entry retired.

## What it leaves for later arcs

- **Level of detail** (arc 2) asks the same index what is visible *and at what size*. A node's
  representation picks from its own box's on-screen extent.
- **The tile pyramid** (arc 3) uses reach boxes to know which tiles a change dirties.
- **Streaming** (arc 4) adds and drops nodes through the feed's structural touches. The index
  updates per node, so a pan that streams 500 nodes costs 500 updates, not a rebuild.
