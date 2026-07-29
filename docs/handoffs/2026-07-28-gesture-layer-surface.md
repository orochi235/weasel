# Handoff: the gesture layer under-publishes

## Status (2026-07-28)

**Both items shipped.** Written from the consumer side after shipping the
feature that wants it (lbx-editor's live auto-length), so both requirements
were concrete rather than speculative.

What landed, and where it differs from what's proposed below:

- **Item 1** — `CanvasHelpers.getGestureBounds(): Bounds | null`, as specified.
  Every recommendation in "decisions worth making deliberately" was taken:
  `insertPreview` only, plain AABB, union across all in-flight handles.
- **Item 2** — landed as `CanvasHelpers.subscribeGestures(fn)` +
  `getGestureVersion()`, **not** on `ToolsApi.dispatcher`. The version-drift
  warning below was right: there is no `ToolsDispatcher` on main. Putting the
  pair on `CanvasHelpers` also answers the item's own framing more directly —
  the snapshot half (`getEffectiveBounds`, `getGestureBounds`) already lives
  there, so both halves are now one object. Renamed from bare
  `subscribe`/`getVersion` because on a "canvas helpers" object those names
  don't say *what* they track. `Dispatcher.getVersion()` was added underneath
  (the counter didn't exist; `subscribe` did).
- **Not done:** publishing `getInFlightHandles()` as a consumer escape hatch.
  It would expose `OngoingHandle` — a much wider surface than either method
  here needs, and the only stated motivation was making Item 1 implementable
  in userland, which Item 1 landing makes moot.

Implementation notes for whoever touches this next:

- `<Canvas>` stays dispatcher-agnostic. All three methods read one optional
  prop, `gestureSource: GestureSource` (`canvas/gestureBounds.ts`), which
  `<SceneCanvas>` builds from its dispatcher via `createGestureSource`
  (`canvas/SceneCanvas/dispatcherGestureBounds.ts`). A bare `<Canvas>` leaves
  it unwired and reports "no gesture in flight" forever.
- Gesture ids are *not* `previewIdsExtra`: that one honors
  `previewHidesSource: false`, so it drops clone ghosts, which do propose
  content. Separate collector, deliberately.
- Rotated previews fold in by their **rotated** extent
  (`axisAlignedBounds`) — "drop rotation" below meant the output field, not
  the input's effect on the union.

Everything below is the original brief, kept for the reasoning.

---

Two independent asks, same root cause: **a consumer can see committed state
perfectly and in-flight gesture state only partially.** Neither is a big change
— both are surface, not engineering. Item 2 is the more valuable of the pair
and the cheaper to do.

1. [`CanvasHelpers.getGestureBounds()`](#item-1-canvashelpersgesturebounds) —
   the geometry a nascent insert has and no id can reach.
2. [Publish the gesture layer's `subscribe`](#item-2-publish-the-gesture-layers-subscribe)
   — so consumers can be *told* when live values change instead of polling.

They compose: item 2 is how you'd want to drive item 1 each frame. But either
can land alone.

---

# Item 1: `CanvasHelpers.getGestureBounds()`

## Goal

Add one method to `CanvasHelpers`:

```ts
/** World-space AABB of everything the in-flight gesture proposes — displaced
 *  poses plus any nascent insert that has no scene node yet. `null` when no
 *  gesture is in flight. */
getGestureBounds(): Bounds | null;
```

It answers a question a canvas consumer genuinely has and currently cannot ask:
**"where is the thing the user is dragging right now, in total?"** Every
existing lookup on `CanvasHelpers` is keyed by node id, which works fine until
the gesture is creating a node that doesn't exist yet.

## Why the consumer needs it

lbx-editor's label auto-sizes to its content: length = rightmost object edge +
5.6 pt. Weasel doesn't commit a drag until pointer-up, so the label used to
snap to its new size at the instant of release rather than following the drag.

That's now fixed by polling `getEffectiveBounds` over every node each frame
(`src/useLiveLength.ts` in lbx-editor). It works for move, resize and rotate,
because those displace nodes that already exist.

It does **not** work for drag-to-insert. Drawing a new rectangle past the end
of the label should grow the label as you draw, but a nascent insert has no id
for `getEffectiveBounds` to be called with, so the label sits still and snaps
on release — the exact wart the feature set out to remove, surviving in one
corner of the UI.

Consumer usage, once this lands (this is the shape the API must support, not
something to implement here):

```ts
// lbx-editor useLiveLength.ts — the per-frame poll becomes:
const poses: LabelPose[] = [];
for (const id of getNodeIds()) {
  const b = helpers.getEffectiveBounds(id);
  if (b) poses.push({ x: b.x, y: b.y, width: b.width, height: b.height });
}
const g = helpers.getGestureBounds();      // <- picks up the nascent insert
if (g) poses.push({ x: g.x, y: g.y, width: g.width, height: g.height });
setLength(fitLengthToContent(poses));
```

Note the consumer still wants the per-node loop: it needs the union with
*committed* content, which `getGestureBounds` deliberately doesn't include.
This method reports the gesture, not the document.

## Where it goes

`helpersForLayers` in `packages/core/src/canvas/Canvas.tsx` (~line 1080) is the
object to extend; the interface is `CanvasHelpers` at ~line 484 in the same
file. `helpersRef` already passes through `SceneCanvasProps` (it is not in the
`Omit` list), so consumers reach it with no further plumbing — lbx-editor is
already reading `getEffectiveBounds` through it today.

## Suggested implementation

Two sources, unioned:

**1. Tool/dispatcher preview poses.** `previewToolBounds(id)` already exists in
`Canvas.tsx` (~line 1062) and resolves a single id through
`firstPreviewBounds` → `firstPreviewPose` → the `previewBoundsExtra` /
`previewPoseExtra` escape hatches. The ids to feed it come from
`aggregatePreviewIds` (already imported in `Canvas.tsx`) — that's the same set
the preview-ghost layer uses, so the two can't disagree about what's mid-flight.

**2. Nascent inserts.** These publish through the dispatcher's overlay surface,
not the ghost surface. `dispatcher.getInFlightHandles()` yields `OngoingHandle`s;
`handle.overlay?.()` returns an `OngoingOverlay`, whose `insertPreview` variant
carries a ready-made world-space `bounds` field:

```ts
{ kind: 'insertPreview'; shape: …; bounds: { x, y, width, height }; extras: unknown; anchorPoint?: … }
```

`useDispatcherOverlayLayer.ts` (`packages/core/src/canvas/SceneCanvas/`) walks
exactly this structure to paint the preview — worth reading first, since a
correct `getGestureBounds` should agree with whatever that layer draws.

Decisions worth making deliberately rather than by accident:

- **Other overlay kinds.** `marquee` and `lasso` are also in-flight gestures
  with geometry, but they select rather than propose content. Including them
  would make a marquee grow lbx-editor's label, which is wrong. Recommend
  `insertPreview` only, and say so in the doc comment — the name says
  "gesture", so the exclusion needs to be explicit.
- **Rotation.** `Bounds` carries an optional `rotation`. A union of several
  boxes can't preserve it; drop it (plain AABB) and document that.
- **Multiple simultaneous handles.** A key-held action can overlap a pointer
  action. Union everything rather than picking a winner the way
  `getActiveAction()` does — a bounds union has no ambiguity to resolve.

## Tests

`packages/core/src/canvas/Canvas.test.tsx` already has a `helpersRef` test
(~line 607) that stubs the shape and reads it after render — the pattern to
follow.

1. Returns `null` with no gesture in flight.
2. Mid-move on one node: equals that node's preview bounds.
3. Mid-move on a multi-selection: equals the union, not the primary's box.
4. Mid-insert with no committed node: equals the `insertPreview` bounds — the
   case that motivates the whole method.
5. A marquee in flight returns `null` (the deliberate exclusion above).
6. Insert *and* move in flight together: the union of both.

## Cost of not doing it

Small and contained: lbx-editor's create-drag keeps snapping at drop. Nothing
is broken, one interaction is just less good than its neighbours. This is a
polish item, not a blocker.

---

# Item 2: publish the gesture layer's `subscribe`

## Goal

Expose, on the consumer-facing dispatcher surface, the change signal weasel
already computes:

```ts
/** Notify on every dispatcher pump — gesture start, phase change, each
 *  pointermove that reaches a handle, and end. Returns an unsubscribe. */
subscribe(fn: () => void): () => void;

/** Monotonic counter bumped on the same events. Pair with `subscribe` for
 *  `useSyncExternalStore`. */
getVersion(): number;
```

## The gap, stated precisely

Weasel already honors the `useSyncExternalStore` contract for **committed**
state. `Scene` publishes both halves, and consumers use them exactly as
intended — lbx-editor's App.tsx does:

```ts
const sceneVersion = useSyncExternalStore(
  useCallback((cb) => scene.subscribe(cb), [scene]),
  () => scene.getVersion(),
);
```

The gesture layer computes the same two halves and publishes **only the
snapshot**:

| Half | `Scene` | gesture layer |
|---|---|---|
| `subscribe(fn)` | public | exists, internal only |
| snapshot | `getVersion()` | `helpersRef.getEffectivePose` / `getEffectiveBounds` (public) |

`subscribe()` and `getInFlightHandles()` are real and load-bearing — weasel's
own `useDispatcherOverlayLayer` (`packages/core/src/canvas/SceneCanvas/`)
depends on them:

```ts
// Re-render on every dispatcher pump so live overlay (marquee, lasso
// polyline) tracks pointermove instead of freezing on the first frame.
useEffect(() => dispatcher.subscribe(forceRerender), [dispatcher]);
```

But the published `ToolsDispatcher` (`ToolsApi.dispatcher`) stops at
`hasActiveGesture()` / `getActiveScratch()` / `getLastRoute()` /
`resolveOnly()`. So a consumer can *ask* whether a gesture is running and can
*read* its live geometry — but can never be **told** that either changed. The
only two ways out are polling on rAF or reaching into internals.

This isn't a missing feature. It's an inconsistency: the same object publishes
a snapshot without the subscription that makes a snapshot useful.

## What the consumer had to do instead

lbx-editor's `src/useLiveLength.ts` runs a `requestAnimationFrame` loop for the
lifetime of a pointer gesture, re-reading `getEffectiveBounds` over every node
each frame, started on the container's `pointerdown` and stopped on window
`pointerup` / `pointercancel`.

It works, and it is entirely a workaround for the missing half:

- polls at 60 fps even when the pointer is stationary and nothing can have
  changed;
- re-implements gesture lifetime tracking from raw DOM events, which weasel
  already knows precisely and just doesn't say;
- has its own start/stop bug surface (a release outside the canvas, a gesture
  cancelled by Escape) that weasel's own signal would get right by
  construction.

With `subscribe` published, that whole file collapses to a subscription plus
the same per-frame read, and the DOM listeners go away.

## Suggested implementation

`dispatcher.subscribe` already exists on the internal `Dispatcher`
(`packages/core/src/interactions/dispatcher/dispatcher.ts`, declared ~line 390,
implemented ~line 1181), alongside `getInFlightHandles()` (~line 380 / ~1177).
The work is forwarding them onto the consumer-facing surface and documenting
the guarantee, not building anything.

Points to settle deliberately:

- **`getVersion()` alongside `subscribe`.** `subscribe` alone forces consumers
  into `useReducer`-based force-rerenders (what weasel does internally).
  A monotonic counter makes `useSyncExternalStore` work directly and matches
  `Scene`'s shape. Worth adding at the same time — the two are one idea.
- **Pump frequency.** Consumers will assume "fires when something changed."
  If the dispatcher pumps on events that change nothing observable, say so, so
  people don't build expensive work directly on the callback.
- **`getInFlightHandles()`.** Publishing it too would let consumers read
  in-flight geometry generically — and would make Item 1 implementable in
  userland rather than in weasel. Reasonable either way, but note that it
  exposes `OngoingHandle`, a much wider type than `getGestureBounds()`'s
  `Bounds | null`. Item 1 stays the better *consumer* API; this is the
  escape hatch under it.

## Version drift — check before writing code

There is drift between published `0.6.0` and current `main`. On main,
`packages/core/src/tools/useTools.ts` says *"It used to also own a dispatcher"*,
and no `interface ToolsDispatcher` exists in the source tree, though the 0.6.0
dist types declare one with `ToolsApi.dispatcher: ToolsDispatcher`.

So **confirm where the live dispatcher hangs off the public API on main** before
implementing. The gap described here is real in what consumers have installed;
the right place to close it may have moved.

## Tests

`subscribe` fires on gesture start, on each pump during a drag, and on end;
the returned unsubscribe stops delivery; `getVersion()` increases monotonically
across the same sequence and is stable when nothing pumps. The existing
dispatcher tests are the place for these.

## Cost of not doing it

Every consumer that wants a value to track a drag writes the same rAF loop, and
each one re-derives gesture lifetime from raw DOM events slightly differently.
lbx-editor has one such loop today. This is the item that pays off repeatedly.

---

# Shared notes

## If you only do one

**Item 2.** Item 1 fixes one interaction in one consumer. Item 2 removes a
whole category of workaround — and if `getInFlightHandles()` rides along with
it, a consumer could implement Item 1's geometry in userland without waiting
for it.

## Related

- lbx-editor spec: `docs/superpowers/specs/2026-07-28-live-auto-length-design.md`
  (in the lbx-editor repo) — full design, plus a section on why leftward label
  growth was cut. Not weasel's problem, but it explains the shape of the
  consumer.
- lbx-editor's `src/useLiveLength.ts` — the rAF workaround Item 2 would
  delete. Worth reading as the concrete "what a consumer writes without this"
  artifact.
- lbx-editor consumes weasel from npm (`^0.6.0`), not a sibling checkout, so
  both items need a publish before the consumer can use them.
