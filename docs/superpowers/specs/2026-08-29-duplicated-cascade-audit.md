# Duplicated-cascade audit — what is left

**Date:** 2026-08-29
**Status:** Tier 1, Tier 2 and half of Tier 4 collapsed. Tier 3 and the walk
unification are open.
**For:** whoever does the rest. Assumes repo familiarity, no session context.
**Answers:** which lookups in this engine are still implemented twice, and which
one survives.

The collapsed half is in `git log` and `.changeset/`; nothing about it is
repeated here. What follows is only what still stands.

## The pattern, and why it hides

One logical question, answered in two places that were supposed to agree. Two
mechanisms produce it here. **Closure vs envelope** — a lookup that closed over
the surface's state at construction keeps answering for the surface however the
call-time envelope reads. **Union declared before table** — a `Record<Union, T>`
compels every site to invent an answer for a new member independently, with
nothing holding the answers to each other.

The fix pattern is in the tree six times now: `CORNER_ANCHORS`, `ICON_PATHS`,
`GESTURE_DESCRIPTORS`, and — added by this work — `PATH_COMMANDS`
(`geom/src/commands.ts`), `SHAPE_KINDS` (`core/shapeKinds.ts`) and the base
table behind `targetSizesPx` (`core/device/targets.ts`). Table first, union
derived by `keyof typeof`, one exported accessor.

## Tier 3 — closure-over-surface, live now that N views exist

Untouched. Each of these paints or answers for view zero in every view, because
`<CanvasView>` draws the surface's layer array unchanged and only the envelope
differs. A `draw: (_data, …)` is therefore a guarantee of answering for the
wrong view, not merely an unused argument.

`usePreviewGhostLayer.ts:80` (a drag in view B ghosts in view A) ·
`useDispatcherOverlayLayer.ts:80` (marquee paints in the wrong view; reads
`isVisible` off the envelope but the dispatcher from a closure) ·
`pathEditingOverlayLayer.ts:114` · `slopsDebugLayer.ts:53` (a debug overlay that
lies about hit regions) · chrome-caps `RuleCtx` (`SceneCanvas.tsx` — rules are
correctly surface-wide, the **ctx** is not, and the same ctx gates dispatcher
eligibility for keyboard dispatch) · pointer world coords
(`PointerProviderIfRoot.tsx:44`, which paste-at-pointer reads) ·
`deps/ingestion.ts:30` (every Cmd+V centers on the wrong camera) · pick
tolerance (`SceneCanvas.tsx`) · `deps/dispatcher.ts:19` (Escape in view B
cancels view A).

**Verdict: COLLAPSE** — publish `getPreviewIds` and the overlay/dispatcher reads
on the view helpers, give `RuleCtx` a per-view construction, and route the rest
through `viewRegistry.resolver.at`, which the virtual-viewports spec already
establishes as the one resolver per surface.

All eleven `exhaustive-deps` suppressions were checked and none is stale in
time — each bottoms out in a ref reassigned every render, with a version key as
the deliberate invalidation signal. `useHandTool.ts:81` still carries four dead
deps (`inertia`, `axis`, `tracker`, `decay`), which is the same inert-options
bug `docs/TODO.md` records. The staleness these sites do have is
surface-vs-view, which no dep array can catch.

## Tier 4 — the walks, structurally

The three live defects are fixed (overrides, the missing clip term, the
marquee's unrotated fast-reject). **The four walks are still four.**

- `useSelectTool.ts:169` — clip-chain aware, override-aware through the
  adapter, unrotated pre-filter, no hidden-layer filter, AABB leaf picking
  unless `leafPicking: 'silhouette'`.
- `useSceneSelectTool.ts:222` — the one `<SceneCanvas>` installs. Layer-major,
  rotation-correct, hidden-aware, silhouette-on, and now clip-aware and
  override-aware.
- `sceneAdapter.ts:446`'s `walkClipAware` — honors clips, orphaned because the
  actions route through `deps/`.
- `deps/hitTestArea.ts:76` — the live marquee and lasso.

They no longer disagree on any case with a test, which is exactly why this is
still worth doing: the next divergence is as silent as the last three were.
**Verdict: COLLAPSE onto one walk** — B's ordering, rotation and visibility plus
A's clip chain and `adapter.getPose`. The obstacle is that A is generic over
`SelectAdapter<TNode, TPose>` with no `Scene`, while B/C/D hold one; the shared
walk has to be adapter-shaped, with the Scene callers going through
`sceneToAdapter`.

Same axis, three more, all untouched:

**Stroke reach.** `NodeShape.ts:486` `inkReach` handles stroke align correctly
and is defeated by a pre-filter using `tolerance` alone, so half a thick outer
stroke's ink is unclickable — and by `ShapeCoversPointOptions.scale` never
being passed, so `{px}` widths resolve as world units while the caller computes
`meanScale(view.scale)` one line above. `canvas/SceneCanvas/poseGeometry.ts:54`
claims *"the pre-filter has to be at least as generous as the refinement that
follows it"*; it is not.

**Text.** Three computations of one quantity: the paint cache (`draw.ts:1282`),
an uncached `layoutRuns` for the silhouette that *cannot* hit that cache (it
keys on array identity), and a Canvas2D `measureText` caret path with no
kerning (`features/text/hitTest.ts:60`) that is currently masked only because it
calls `getContext('2d')` on a WebGL canvas and gets `null`.

**Alpha and `layerOrder`** are paint inputs no hit path reads — a node faded to
alpha 0 is invisible and fully clickable, and a layer omitted from `layerOrder`
is undrawn yet still claims clicks.

## Comments that assert a collapse which never happened

Two still stand:

- `canvas/NodeShape.ts:6`, `:233`, `:285` — the silhouette is *"the same
  boundary used for clipping and SVG export."* The exporter is not among
  `findShapeSilhouette`'s five callers.
- `canvas/SceneCanvas/poseGeometry.ts:54` — see "Stroke reach" above.

## Found while collapsing

New, and none of it fixed. Each is the same pattern in a place the audit did not
reach.

- **Three path walkers have no `default:` arm**, so a sixth opcode would stop
  their coordinate cursor advancing and silently misparse everything after:
  `features/paths/booleans.adapter.ts:89`,
  `interactions/actions/edit-anchors/geometry.ts:65`,
  `geom/src/booleans/adapter.ts:100`. Five sibling walkers throw, which is fine.
- **`CanvasView.tsx:209` is a second `buildAffordanceAt` call site** and reads
  no device profile, so a nested view hit-tests at the fine-pointer size. It
  renders inside `<SceneCanvas>`'s `DeviceProfileProvider`, so the fix is
  `useDeviceProfile()` and one option.
- **`move/gestureAdapter.ts` has no `index` parameter on `insertNode`** and
  neither ordering accessor, so undo through the move pipeline still appends.
  `arrayAdapter` has no `setChildOrder` either, so it places by ordinal rather
  than by anchor — deliberate for now, and the reason the ordinal fallback
  exists beside the anchor.
- **`flipPoseAboutBounds` carries `rotation` through unchanged**, so flipping a
  30°-rotated shape should leave it at −30° and does not. Extents stay correct
  (a rotated box's AABB is symmetric under a sign flip), which is why it hides;
  an asymmetric rotated shape is translated rather than mirrored.
- **Alignment guides are half rotation-aware.** `alignMoveBehavior` folds the
  dragged selection by ink; `deriveAlignmentGuides` still advertises a
  stationary rotated sibling's lines at its unrotated edges, and `AlignBounds`
  has no `rotation` field to carry one — the moving side works only because
  `RECT_ALIGN_PROJECTION.boundsOf` is identity and passes `rotation` through
  undeclared. A custom projection loses it silently.
- **`useDistribute`'s `gaps` mode** still divides by unrotated sizes. Reachable
  only through the hook; `defaults/distribute.tsx` hardcodes `centers`.
- **`RegistryDetail.tsx`'s `describeBinding` is a fourth `GestureSpec`
  formatter**, and `flattenActionBindings` does not use `routesForSpec` — which
  is why the ingest action's drop/paste bindings still do not appear in the
  route list even though the projection now handles them.

## What this audit falsified

- **The pinch-zoom suspect is stale.** The double-apply is already fixed
  (`SceneCanvas.tsx` deliberately omits `viewport` from its `<Canvas>`, per
  `.changeset/mac-trackpad-pinch-zoom.md`). What remains is that
  `usePinchZoomTool` is dead-but-exported surface, and that zoom clamps are
  declared seven times in two disagreeing families (`0.1/8` in `zoomAt` and
  three re-declarations; `0.1/10` in `fitViewToBounds`, `wheelHandler`,
  `useZoom`) — so fit-to-bounds can produce 10× and the next pinch frame clamps
  it to 8×. Wheel behavior is answered three times with **inverted modifier
  meanings**, all three public. Filed under Viewport in `docs/TODO.md`.
- **The `previewIdsExtra` / `previewPoseExtra` suspect is refuted.** Both ends
  walk tools→handles in the same order, and the one asymmetry is deliberate and
  documented at both ends. The real defect on that axis is the preview-rotation
  pair (`useViewHelpers.ts:163` attaches rotation, `:206` forty lines below does
  not — held together only because `RECT_POSE_DESCRIPTOR.getBounds` is identity).

Corrected by execution during the collapses:

- The GL gradient ramp extrapolated **above the last stop as well as below**,
  and the coincident-stop disagreement runs the opposite way from what the audit
  said (the ramp took the later stop, the editor the earlier). The
  below-first-stop case also only shows with mid-range colors —
  `Uint8ClampedArray` clamps a saturated extrapolation back to the endpoint.
- The handle finding mixed units: paint size is a full edge, hit radius a
  half-extent, so a coarse pointer painted a ±7px box inside a ±8px grab zone.
  The real defect was that touch forgiveness never reached the hit-test at all.
- `useRotateTool`'s `rotationHandleDistance` is **live**, not dead — it is the
  annulus band thickness. Only `handleHitRadius` was dead, and is gone.
- Recording a sibling index on the delete and reparent ops was **necessary but
  not sufficient**: history replays a batch's inverses in reverse, so no
  per-op index rule can restore a multi-node batch. Slots carry an anchor now.

## Deliberately not collapsed

Local- vs world-space bounds, and `nodeAtPoint` vs `pickBest`, are different
questions. Miter apex vs capsule and butt cap vs half-disc are a defensible hit
model over shared base geometry. `unionBounds` stays rotation-free beside
`unionAABB` for commit-time actions that write poses back in the unrotated
frame. SVG's `#000000` initial fill is a spec default, not drift.
`resolveNodeFill`'s split between `kit:path` and `kit:shape` is documented and
correct. `useBuiltinShapeTools`' nine hook calls are not a list, and are already
compiler-linked through the return type. Stroke align, clip and text layout
genuinely cannot round-trip through SVG 1.1 — but the exporter must say so out
loud, which today it does not.

## Adjacent, not this pattern

Worth their own entries: `selectAll` has no visibility filter, so Cmd+A then
Delete removes nodes the user cannot see; SVG export ignores `layer.visible`
while pixel export honors it; `LayerRecord.locked` is written in five places and
read by nothing; user layers lose their `name` through `toJSON`; `<image>` flip
and source-rect never serialize; `packages/{svg,hud,ui,labkit,modes,d3,paint}`
never import `geom` at all, and three incompatible matrix-singularity policies
coexist.
