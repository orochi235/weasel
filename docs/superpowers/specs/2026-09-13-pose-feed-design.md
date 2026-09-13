# The pose feed

**What this is:** the channel a renderer weasel does not own uses to keep its
objects in step with a `Scene`. It publishes what changed, never how to draw it.

**Who it is for:** whoever builds the host side of a consumer-owned renderer —
the 3D kernel first, but nothing here is 3D.

**What it answers:** a retained renderer keeps one object per node and wants to
mutate only what moved. `Scene.subscribe` carries no payload and `getVersion()`
is one scene-wide counter, so today a host is told "something changed" and
rebuilds every node's draw record.

Settled beforehand in `2026-08-22-3d-kernel-design.md`: the kernel hosts a
renderer rather than owning one.

## It belongs in core, not in the 3D kernel

The feed reads `Scene` and nothing else — no camera, no projection, no
dimension. A 2D consumer hosting its own renderer wants the identical thing, so
this lives in `packages/core` beside `effectivePose`, and the 3D kernel consumes
it like any other host.

## Shape

```ts
interface PoseFeed<TData, TLayer, TPose> {
  /** Notified when there is something new. Wire it to whatever schedules a
   *  repaint — in labkit, `surface.invalidate(tileId)`. */
  subscribe(fn: () => void): () => void;
  /** Everything since the last read. Empty where nothing changed. */
  read(): FeedDelta<TData, TLayer, TPose>;
}

interface FeedNode<TData, TLayer, TPose> {
  node: Node<TData, TLayer, TPose>;
  /** The document pose composed with any override. `node.pose` is still the
   *  document pose, so a host has both without a second channel. */
  pose: TPose;
}

interface FeedDelta<TData, TLayer, TPose> {
  added: readonly FeedNode<TData, TLayer, TPose>[];
  removed: readonly NodeId[];
  changed: readonly FeedNode<TData, TLayer, TPose>[];
  /** Discard the object map and rebuild: the first read, and any change the
   *  feed could not express as a delta. */
  reset: boolean;
}
```

`FeedNode.pose` is `effectivePose`, which `Scene` documents as "the same answer
the renderer uses"; `node.pose` beside it is the committed one. That pair is how
a host draws a dragged solid at both its committed and its proposed position
without a second channel. The name avoids core's existing `PosedNode`, which is
the structural input `effectivePose` reads and is a different thing.

**The consumer owns the `Map<NodeId, Object3D>`.** The feed publishes ids and
poses and never holds a renderer object. That is what keeps it renderer-agnostic.

## How a delta is computed

Two subscriptions, because the scene deliberately has two clocks. Committed
edits bump `getVersion()`. Overrides do not — they are ephemeral presentation
state with their own `subscribe()` and `getGeneration()`.

- **Overrides moved.** The changed set is `overrides.ids()`, plus the ids that
  were overridden on the previous read and no longer are. `O(changed)`.
- **Version moved.** Walk `scene.nodes` and reference-compare against the
  previous snapshot. `O(n)`, three `!==` per entry, never a deep compare.

  **Compare the references a node carries, not the node.** The scene mutates
  node objects in place and swaps `pose` and `data` for new references —
  `kit:setPose` is `node.pose = p.to` on the object already in `state.nodes`.
  So a cached node is `===` its own future self and reports nothing, and a
  cached node's `.pose` is already the new value. The feed snapshots
  `{ pose, data, layer }` per id instead, which is the same key `nodeMemo`
  uses for the same reason.

  The snapshot's `pose` is the **effective** pose, not `node.pose`. A derived
  node's pose changes when a node it depends on moves: `invalidateDependents`
  drops its memo slot, the next `effectivePose` recomputes to a new reference,
  and nothing about the node itself changed. Comparing the effective pose
  catches that case and the ordinary one with a single `!==`.
- **Both in one frame.** Union them; a node in both appears once, at its
  effective pose.

Watching both clocks is what keeps the `O(n)` walk off the hot path. A drag
streams frames and touches only overrides, so it costs `O(changed)`. The walk
runs on the frames where committed content changed — a commit, an undo, a paste
— which arrive one at a time.

`reset` is set on the first read and nowhere else.

**The delta carries no order, and does not try to signal one.** `added` and
`changed` follow `scene.nodes`, which is insertion order. A host that draws in
order calls `renderOrderNodes()` itself — it is cached until a structural edit
and hands back the same array, so re-reading it every frame costs nothing.

An earlier draft made a reorder force a `reset`. It was wrong three times over,
and the reasoning is worth keeping because the idea is an easy one to have
again. `scene.roots` and `scene.layers` are spliced in place, so an identity
comparison on them can never fire. Keying off `renderOrderNodes()` identity does
fire, but then every ordinary insert resets the whole scene unless it is gated
on the walk finding an empty diff — and that gate drops the frame where a node
moved *and* something reordered, leaving the host painting new poses in the old
sequence. And none of it is needed, because the host can read the order
directly.

What the feed does still guarantee is that a structural edit never reports a
live node as `removed`. A host told that would delete a real object.

## The feed does not coalesce

`subscribe` says "something moved, consider repainting" and nothing more. It
forwards both clocks verbatim, so one gesture step can notify more than once —
`PoseOverrides.set()` and `commit()` each publish
(`packages/core/src/core/scene/poseOverrides.ts`), and a `setPose` plus a staged
override plus its commit reaches a listener three times.

That is the host scheduler's problem, and it already solves it: labkit's
listener is `surface.invalidate(tileId)`, which is idempotent and collapses to
one paint per rAF. A feed that collapsed the burst itself would be taking on
timing semantics it has no business owning, and `read()` would still need to see
every generation bump to compute its delta.

The same reasoning applies to tests: asserting an exact notification count
couples the feed to a neighbouring module's publish cadence. Assert that each
clock reaches the listener.

## What the feed is not

Non-node chrome does not travel here. A marquee rect, a lasso trail and an
insert outline are no node at all, and `resolveOverlays` already answers for
them in world geometry. A host draws two things: the feed's nodes, and the
overlays' geometry.

## Two things the 3D lab does that a host should not copy

**The scene-to-repaint path must not route through React.** The lab runs
`scene.subscribe` into a `useState` bump, then a `useEffect`, then
`surface.invalidate` — a render per scene change purely to schedule a paint. Its
own `dispatcher.subscribe(repaint)` already goes direct. The feed's `subscribe`
is wired straight to the invalidate.

**`Scene.overrides` is the in-flight pose channel and the lab bypasses it.** It
collects ghosts from `dispatcher.getInFlightHandles()` instead, deliberately:
`moveAction` declares `previewHidesSource: true` and the lab wanted the source
solid to stay drawn. A `FeedNode` carries both poses, so the feed gets the same
picture without a ghost channel.

## Testing

The feed is pure — a scene in, a delta out — so it needs no renderer and no
WebGL, and it is tested against a bare `Scene`: the delta after a `setPose`,
after an override `commit`, after an undo, after a removal, after a reparent,
and that a first read reports `reset`.

That the drag path does not walk the node map is the claim worth guarding, and
it is not observable from the delta. The test wraps `scene.nodes` in a `Proxy`
counting reads of `Symbol.iterator` and asserts the count is unchanged across an
override commit. That is a real observation of this code, not of an emulation —
but write the naive version that scans unconditionally first and watch the
assertion fail, because a counter that is never incremented also reads as zero.
