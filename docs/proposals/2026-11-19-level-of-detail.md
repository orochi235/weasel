# Level of detail

**Status: designed 2026-11-19, unbuilt.** Arc 2 of the scale arcs (`docs/TODO.md`, "Scale", the
"Level of detail" entry, which holds its closing condition). Builds on arc 1,
`docs/proposals/2026-11-19-render-visibility.md`, and assumes its touched-ids feed and reach boxes.
For whoever builds it, and for arc 3 (the tile pyramid), which bakes tiles through the same choice.

## The problem

A node draws the same way at every size. A painter gets `pixelScale`
(`packages/core/src/canvas/nodeShapeTypes.ts`, `NodePaintCtx`) and can size resolution-dependent
work by it, but nothing chooses between different drawings of a node, and nothing stops the walk
at a group too small to show its children. Zoomed out over 100k nodes, every node still paints in
full, text lays out glyphs a pixel tall, and `buildSceneTree` visits every descendant of a group
that covers four pixels.

`pixelScale` stays: it tunes one drawing continuously. A **representation** is a discrete
alternative drawing, and picking one is what this arc adds.

## Declaring representations

A **ladder** is a node's representations, ordered coarse to fine, each shown from an on-screen
size upward. A **rung** is one of them.

```ts
type RungId = string;                       // 'full', 'box', 'none', or a painter's own

interface Rung<TData, TPose> {
  id: RungId;
  /** Shown when the node is at least this many device pixels, up to the next rung's `fromPx`. */
  fromPx: number;
  /** What it draws. Absent: the painter's own `paint`. */
  paint?(node: Node<TData, string, TPose>, pose: TPose, ctx: NodePaintCtx): DrawCommand[];
  /** `'skip'` draws this rung in place of the node's children, which are not visited. */
  children?: 'walk' | 'skip';
  /** The outline picking hits at this rung. Absent: the painter's `silhouette`, or, under
   *  `children: 'skip'`, the subtree's box. */
  silhouette?(node: Node<TData, string, TPose>, pose: TPose): Path | null;
}

interface Ladder<TData, TPose> {
  rungs: readonly Rung<TData, TPose>[];     // ascending `fromPx`; the first is 0
  /** The world length measured against `fromPx`. Default: the longest side of the node's own
   *  box, or of its reach box when any rung skips children. */
  sizeOf?(node: Node<TData, string, TPose>, pose: TPose): number;
  hysteresis?: { up: number; down: number }; // default { up: 1.5, down: 0.67 }
  fadeMs?: number;                           // default 0: a rung change swaps in one frame
}
```

Two places declare one:

| Where | Declares | Serializable |
|---|---|---|
| `NodeShapeEntry.ladder` | a kind's rungs, with their painters and `sizeOf` | no; code |
| `node.lod` | one node's thresholds: `readonly { as: RungId; fromPx: number }[]` | yes, saved with the node |

`node.lod` names rungs and moves thresholds; it cannot add a painter. It may name the painter's
rungs or the kit's built-in ones, which every node has:

| Rung | Draws | Children |
|---|---|---|
| `full` | the painter's `paint` | walked |
| `box` | the node's pose box in its own frame (`groupBoxPath`, `nodeShapes/groupBoxPainter.ts`), or its reach box where the pose is no box, filled from `lod`'s `fill`, the node's inherited fill, or the `--wzl-lod-box` token | skipped |
| `none` | nothing | skipped |

A node with neither declaration has one rung, `full`, and draws exactly as today. A view option,
`collapseBelowPx`, gives every group without a ladder of its own `[none 0, box 2, full N]`; it is
off by default.

## Picking a rung each frame

The size of a node on screen is `sizeOf(node) × pixelsPerUnitAt(box)`, where the host supplies
`pixelsPerUnitAt` from the node's arc-1 box (the reach box when a rung skips children). The rung is
the highest whose `fromPx` the size reaches, moved only past hysteresis: from rung *i*, up to rung
*j* once the size reaches `fromPx_j × up`, and down once it falls below `fromPx_i × down`. That
leaves a dead band of `[0.67t, 1.5t)` around each threshold *t*, as pezlie's `pickLevel`
(`wall/src/levels.ts`) does. Several rungs can move at once on a fast zoom.

The pick happens in `buildSceneTree`'s visit, after arc 1's index admits the node and before its
painter runs. A `skip` rung stops the descent there, so a collapsed group costs one visit however
large its subtree. Arc 1 prunes what is off screen; this prunes what is too small. Together the walk
visits nodes that are on screen and large enough to need their own drawing.

**State.** Hysteresis needs the rung each node showed last frame, and that differs per view: a
minimap sees every node smaller than the canvas beside it does. So the state is a `LodState` per
view, held where the view's frames are built (the view registry for a `<SceneCanvas>` view, the
component for a `<SceneViewCanvas>`, the worker's view for a worker render), and passed to the walk.

```ts
interface LodState {
  rungOf(id: NodeId): RungId | undefined;   // what this view drew last frame
  collapsedAbove(id: NodeId): NodeId | null; // the nearest ancestor drawn at a `skip` rung
}
```

Entries are `NodeId → (rung, frame stamp)`. Each frame writes the nodes it visits; at the end of the
frame, entries the frame did not visit are dropped. So the state holds at most the nodes visited in
the last frame, which arc 1 bounds by what is on screen. A node that leaves the screen and comes
back picks afresh, without hysteresis, which cannot flicker because nothing was shown in between. A
node removed through the feed's structural touch leaves at once.

**Stateless callers.** `renderSceneToPixels` and a tile bake pass no state and pick by thresholds
alone, which is deterministic for a given scale. Vector exports (SVG, PDF) draw `full` always:
their reader zooms after the fact.

**Fade.** With `fadeMs`, the entry also keeps the outgoing rung and its start time, both rungs draw
with complementary alpha until it ends, and the frame loop keeps requesting frames meanwhile.

## Picking and hit-testing: what is drawn is what is hit

| Rung showing | Point pick | Marquee and lasso | GPU id pass |
|---|---|---|---|
| `full` | as today | as today | as today |
| a painter's own | the rung's `silhouette`, else the painter's | the same outline | the node's `pickId` |
| `box` (children skipped) | the group, by its box; none of its descendants | the group as one item | the group's `pickId`, already on its wrapper |
| `none` | nothing | nothing | nothing |

The pick index stays view-independent: its BVH over `nodeBroadBox` does not change with zoom. The
pick walk reads the asking view's `LodState`: a candidate drawn at `none` is passed over, and one
whose `collapsedAbove` answers an ancestor becomes that ancestor (O(depth), for the handful of
candidates a point pick finds). Snapping reads the same: a collapsed group offers its box's edges
and corners, not its children's. Reading the rung last drawn, never recomputing it, is what makes
a click land on what the user sees.

The scene, the selection and the layers panel are not views and ignore all of this: selecting a
collapsed group's child from the panel still works, and zooming in shows it selected.

For a worker render the state lives in the worker, where the walk runs. Each frame posts the ids
whose rung changed into or out of `skip` or `none`; the main thread keeps that set for picking.

## 3D

Nothing in the choice is `{x, y}`. Its inputs are a world length (`sizeOf`) and a pixels-per-unit
at a box, and boxes are arc 1's `Float64Array` `[min…, max…]` of any dimension.

| Host | `pixelsPerUnitAt(box)` |
|---|---|
| 2D view | `pixelScaleAt(view, dpr)`, the plane's view for a parallax layer: one number per plane |
| kernel3d, perspective | focal length in device pixels over the depth of the box's nearest point, clamped at the near plane |
| kernel3d, orthographic | the camera's scale × dpr, one number |

A 3D host gets the same `LodState` and the same rung rule. Its rungs are its own (a mesh at fewer
triangles, a billboard), declared on whatever it draws nodes with, and `box` draws the subtree's
3D box. Its ray pick promotes a hit inside a collapsed subtree to the group, exactly as the 2D pick
does.

## Charts and diagrams

| Package | Ladder | What changes on zoom out |
|---|---|---|
| `text-tools` (`kit:text`) | `none 0`, `greek 3`, `full 6`; `sizeOf` is the font size, not the box | lines draw as gray bars, then not at all; glyph layout stops below 6 px |
| `plot` text marks | inherit `kit:text`'s | axis and data labels drop out before the marks do |
| `plot` root | `aggregate` below a mark spacing of 2 px; `sizeOf` is the plot box over √(mark count) | marks draw as a density summary binned in the plot's own frame, children skipped |
| `diagram` containers | `none 0`, `box 4`, `header 24`, `full 80` | the `header` rung reuses the painter for `collapsed: true` (header row alone) without writing that field; it is view state, not document state |

The plot's summary bins in the coordinates its scales map into, at a bin size of a few device
pixels converted to world through `pixelsPerUnitAt` and rounded to a power of two, so a small zoom
reuses the cached bins and a 3D plot bins in voxels the same way. The cache is keyed on the plot
root, the bin size and the feed's touches to its marks, and bounded per view like `LodState`.

Connectors keep their routed paths when an end's container collapses: rerouting to a collapsed
boundary is a routing change, and routing is per scene, not per view.

## How it's measured

A spec in `tests/perf/`, run on the fleet as a perf job (not a test run): 100k rect nodes in 1000
groups of 100, the whole scene on screen, each group at about 10 px, with `collapseBelowPx: 24`.
The frame time is compared with 1000 rects drawn as a scene alone; within 2× passes. Each run's raw
frame times and visit counts go to disk, per the repo's measurement rules.

The TODO entry closes when all of these hold:

- `kit:text` ships its three rungs, switched by the engine.
- A test pins the hysteresis: a zoom oscillating ±10% about a threshold for 300 frames changes no
  rung, and a sweep through one changes it once each way, at 1.5t going up and 0.67t going down.
- A test pins the bound: a pan across the 100k scene never holds more `LodState` entries than the
  last frame visited.
- A pick test: a click on a collapsed group's box selects the group, and a click on a `none` label
  falls through to what is under it.
- A demo zooms out over a labeled diagram: labels drop out, then containers draw as boxes.

## Order of work

1. `Ladder`, `node.lod`, the built-in rungs, and the rung rule with its hysteresis tests, as pure
   functions.
2. `LodState` per view and the choice in `buildSceneTree`'s visit, with the `skip` descent; the
   bound test.
3. The pick walk, snapping and the GPU id pass reading the state; the worker's posted set.
4. `kit:text`'s rungs; diagram containers; the demo.
5. kernel3d's `pixelsPerUnitAt` and a 3D consumer.
6. The plot root's aggregate rung and its bin cache.
7. The perf spec, and the TODO entry retired.

## What it leaves for later arcs

- **The tile pyramid** (arc 3) bakes each tile level statelessly at that level's scale, so a tile's
  pixels are a function of its level alone and never depend on how the user zoomed to it.
- **Streaming** (arc 4) can load a subtree's coarse rung before its children: a collapsed group
  needs only its box to draw.
