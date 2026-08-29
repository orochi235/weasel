# Duplicated-cascade audit — findings and verdicts

**Date:** 2026-08-29
**Status:** Audit complete. Nothing fixed yet.
**For:** whoever does the collapses. Assumes repo familiarity, no session context.
**Answers:** which lookups in this engine are implemented twice, which of those pairs
disagree today, and which one survives.

Closes the investigation half of the `docs/TODO.md` P1. The remaining work is the
collapses listed here.

## The pattern, and why it hides

One logical question, answered in two places that were supposed to agree. The
motivating instance: selection chrome resolved bounds through the overlay layer's
`getPose` chain and through `useViewHelpers`' `boundsWithPreview`, which consulted the
same preview sources in opposite priority and only one of which carried rotation.

Two mechanisms produce it here. **Closure vs envelope** — a lookup that closed over the
surface's state at construction keeps answering for the surface however the call-time
envelope reads. **Union declared before table** — a `Record<Union, T>` compels every
site to invent an answer for a new member independently, with nothing holding the
answers to each other.

The fix pattern is already in the tree three times: `CORNER_ANCHORS`
(`interactions/actions/resize/cornerHandles.ts:41`), `ICON_PATHS` (`ui/src/icons/paths.ts:4`)
and `GESTURE_DESCRIPTORS` (`gestures/src/grammar/gestures.ts:52`) — table first, union
derived by `keyof typeof`, one exported accessor.

## Comments that assert a collapse which never happened

Read this section first. These are load-bearing: each one tells a reader auditing the
area that the work is done, and each is false.

- `canvas/SceneCanvas/dispatcherGestureBounds.ts:17` — *"the reported bounds and the drawn preview can't disagree."* They do; see L7.
- `canvas/sceneAdapter.ts:322` — *"this is the pose `buildSceneTree` draws AND the one `pickEvery` tests."* SceneCanvas's `pickEvery` bypasses the adapter; see L5.
- `core/scene/types.ts:268` — a pose override *"replaces the node's document pose everywhere the render and hit-test paths read one."* Three hit paths never read overrides.
- `core/gradient.ts:28` — `sampleGradientStops` *"matching how the GL ramp texture is built."* It does not; see L4.
- `canvas/NodeShape.ts:6`, `:233`, `:285` — the silhouette is *"the same boundary used for clipping and SVG export."* The exporter is not among `findShapeSilhouette`'s five callers.
- `canvas/SceneCanvas/poseGeometry.ts:54` — *"The pre-filter has to be at least as generous as the refinement that follows it."* It is not; see Tier 4, "Stroke reach".
- `apps/draw/src/dev/registryProbe.tsx:236` — drop/paste *"shipped without route-grammar names."* `docs/TODO.md:212` records that closed on 2026-08-16.

Delete or correct each of these whether or not its collapse lands.

## Tier 1 — live, user-visible

**L1. Deleting a group destroys its children on undo.** `createDeleteOp.invert()`
(`core/ops/delete.ts:32`) re-inserts one node; `apply` calls `removeNode`, which cascades
the subtree. `insertNode` → `scene.add` → `kit:add` builds `children: []`
(`core/scene/scene.ts:341`). `scene.remove`'s own `kit:remove` snapshots the whole
subtree and reverts it correctly (`:388`), but `applyBatch` sets `suppressRecording`
(`:1002`) so the kit op is never the recorded entry. `buildDeleteOps`
(`interactions/actions/defaults/delete.ts:44`) emits one op per top-level node and skips
descendants deliberately.

Verified by execution against a real scene on `main` and on `arc1-derived-geometry`:
delete a container with two children, undo, and the container returns with `children: []`
while both children are gone. **The in-flight branch does not fix this.**
`delete.test.ts:52` stubs `remove` as a non-cascading `nodes.delete(id)` and asserts no
undo at all, so no test can catch it.

**Verdict: COLLAPSE.** `createDeleteOp` must capture the subtree, or route to `kit:remove`.

**L2. Union AABB is rotation-blind in ten of eleven implementations.** `axisAlignedBounds`
(`canvas/gestureBounds.ts:57`) expands the four corners and documents exactly why —
folding the unrotated box *"would under-report the extent of a mid-rotate node exactly
when the consumer is watching it move."* It has **one non-test caller, inside its own
file** (`grep -rl axisAlignedBounds` → `gestureBounds.ts` and its test).

Blind: `core/selection/chromeState.ts:75`, `features/groups/unionBounds.ts:13`,
`actions/defaults/rotate.ts:149` (the multi-rotate pivot), `actions/align/align.ts:86`,
`defaults/distribute.tsx:44`, `defaults/flip.ts:51`, `defaults/group.ts:68`,
`features/selection/overlay.ts:201`, `apps/draw/src/svgExport.ts:214`. The rotation-aware
`svg/serialize.ts:322` is bypassed because draw always supplies its own `viewBox`.

`chromeState.unionBounds` is the severe one: `affordances/cornerResize.ts:104` and
`rotationHandle.ts:154` hand it out as the target bounds for paint *and* hit-test. Select
two shapes, rotate one 45°, drag the pair — the frame and its handles sit inside the
rotated shape's ink, while `getGestureBounds()` reports the correct larger box. Zero
rotation coverage in the union, align, distribute, flip and group tests.

**Verdict: COLLAPSE** onto expand-then-union, beside `unionBounds` in `features/groups/`.
`actions/resize.ts:330` is the one documented-intentional exception.

**L3. Handles paint scaled and hit-test unscaled.** Paint is
`HANDLE_BASE_PX * targetScale` (`SceneCanvas.tsx:231`); the hit default is
`HANDLE_HIT_RADIUS = HANDLE_BASE_PX` (`affordanceAt.ts:50`, `:121`), and neither
`buildAffordanceAt` call site passes the option. `COARSE_TARGET_SCALE = 1.75`, so a coarse
pointer paints at 14px and grabs at 8px. `SceneCanvas.tsx:1148` computes the right number,
comments that it should track the painted size, and dead-ends —
`useRotateTool.ts:78` says the knob is unused. `core/device/targets.ts:6` names this exact
failure as why the constants were consolidated. `slopsDebugLayer.ts:61` is a third
unscaled copy. **Verdict: COLLAPSE.**

**L4. The gradient the canvas paints is not the gradient the editor shows.**
`buildGradientRamp` (`renderer/cache/GradientRampCache.ts:28`) has no below-first-stop
guard, so `lo` stays 0 and `frac` goes negative and extrapolates; `sampleGradientStops`
(`core/gradient.ts:37`) returns the first stop's color. A gradient whose first stop sits
at 0.5 paints a cyan band across the left half of the shape while the editor track shows
flat gray. They also invert on coincident stops (ramp yields `lo`, editor documents "take
the later one" and yields `hi`), and use different parsers — `{color:'red'}` renders fine
and throws in the editor. **Verdict: COLLAPSE** onto one sampler; the editor's semantics
are the correct ones.

**L5. Pose overrides are painted through and picked around.** `sceneAdapter.getPose:323`
honors `scene.overrides`; `useSceneSelectTool.ts:242` (pickEvery), `:258` (`wiredBoundsOf`,
which feeds chrome and the affordance `ChromeState`) and `deps/hitTestArea.ts:95` (marquee
and lasso) all read `n.pose` raw. The ForceGraph demo paints every node at its simulated
position and picks it at its baked one. The apparent guard test
(`sceneAdapter.overrides.test.ts:98`) exercises `adapter.getPose` and asserts in a comment that
this is what `pickEvery` does — true of `useSelectTool`'s default, false since SceneCanvas began
passing its own. **Verdict: COLLAPSE** — read poses through the adapter. **This is the same
change as the Tier 4 walk collapse**, not a separate one: a single walk that takes poses from the
adapter and carries the clip chain fixes this, the four-walk split and the clip-ignored-at-pick
gap together.

**L6. Conic gradients export a dangling reference, silently.** `gradientXml`
(`svg/gradients.ts:233`) returns `''` for conic and falls back to the registry's `toSvg`
slot, which `core/paintKinds.ts:109` declares and **nothing implements** — while the
element already carries `fill="url(#gradN)"`. The pattern path warns; this one does not.
The shape disappears in a browser. **Verdict: COLLAPSE** onto the pattern path's behavior.

**L7. A nascent insert's extent is answered three ways.** Painter
(`useDispatcherOverlayLayer.ts:123`) and commit (`canvas/deps/insert.ts:125`) resolve
extras-first; `dispatcherGestureBounds.ts:53` reads the drag rect only. On a centered
Alt-drag the painted circumradius is `d√2` against a reported half-extent of `d`, and a
purely horizontal Alt-drag reports **height 0** for a visibly tall star. Pencil is worse:
bounds is start→current while the painter strokes `extras.samples`, so a scribble that
loops back reports ≈0. **Verdict: COLLAPSE** onto one exported `insertPreviewExtent(ov)`
that the painter and the commit factory also call.

**L8. Reparent's inverse drops the sibling index.** `kit:move` records
`fromParent/fromIndex/toParent/toIndex` (`scene.ts:861`); `ops/reparent.ts:30` forwards no
index, so undo appends. Cmd+G three shapes from the middle of a root list, undo, and paint
order changes. `ungroup` passes an explicit index and is safe; `group` uses
`createReparentOp` and is not. **Verdict: COLLAPSE** — `ReparentArgs` needs both indices.

## Tier 2 — half-collapsed fixes and drifted tables

**H1. The motivating fix was applied to the wrapper only.**
`createSelectionOverlayLayer` (`features/selection/overlay.ts:678`) reads `ChromeState`
off the envelope, resolves `MULTI_RESIZE_TARGET_ID` to `unionBounds`, honors chrome-caps
and suppression, and makes `getSelection`/`getPose` optional — its `getPose` doc states
the rule: *"one cascade, the one the chrome state was built with, rather than a second one
here that has to agree with it."* `createSelectionOutlineLayer` (`:612`) and
`createSelectionHandlesLayer` (`:634`) do none of it: `draw: (_data, view)` ignores the
envelope, both **require** the old `getPose` cascade, and neither knows about the multi
union, chrome-caps or suppression. Both are public (`index.ts:535`) and the wrapper's own
doc (`:674`) calls itself *"equivalent to stacking"* them. No internal caller — which is
how they drifted. **Verdict: COLLAPSE or delete.**

**H2. Path command opcodes exist five times.** `core/geometry/path.ts:20` and
`geom/src/commands.ts:6` each declare `M=0 L=1 C=2 Q=3 Z=4` and `PATH_CMD_LENGTHS`;
`features/paths/{transform.ts:86,poseRotation.ts:96,poseDescriptor.ts:95}` each carry a
`COORD_COUNT` literal. Agreeing today. A sixth opcode desynchronizes two packages'
reading of the same `Uint8Array` with no exception and no type error — every walker
misparses the coord stream from that point. Largest blast radius in the audit.
`forEachSegment` already exists as the shared walker. **Verdict: COLLAPSE.**

**H3. `SPEC_KIND_TO_GESTURE` disagrees on `drop`/`paste`.** `tools/routing/reflection/registry.ts:58`
maps both; `apps/draw/src/dev/registryProbe.tsx:241` returns `undefined`, so
`specToRouteStrings` early-returns and **every drop/paste binding is absent from the draw
inspector.** Was deliberate, now drift. Three more same-question duplications between
those two files (`specToRouteStrings`/`argOf`, `modSpecToParsed`/`parseModSpec`,
`targetSpecToString`/`targetOf`). **Verdict: COLLAPSE** — export from `registry.ts`.

**H4. Pref leaf kind: two declarations, four renderers, no compile error.**
`tools/prefs.ts:11` vs `ui/components/Prefs/schema.ts:105` ("keep the two in sync
field-for-field"). Core's `ToolPrefEnum` has `encoding` and `options[].disabled`; ui's has
neither, so a dash-array leaf in `PrefsForm` selects nothing. labkit's two renderers are
missing `paint` and `object` with differing placeholders. All four switches end in
`default:`, so this union produces **no error at any site** when it grows — the one case
where the safety net the TODO assumes isn't present. The stated reason for the copy is
undercut by `SelectionPanel.tsx:16` importing core anyway. **Verdict: COLLAPSE**, and
replace the `default:` clauses with exhaustiveness guards.

**H5. `Op.name` — the inspector lists 7 of 11.** The registry
(`core/ops/registry.ts:18`) holds `insert, delete, transform, setData, setText, setPath,
setLayer, setSelection, reparent, reorder, moveToIndex`; `OP_KIND_NAMES`
(`apps/draw/src/dev/registryData.ts:296`) omits `setData`, `setLayer`, `reorder`,
`moveToIndex` while claiming to mirror them. **Verdict: COLLAPSE** — enumerate the map.

**H6. Built-in shape kind, nine enumerations.** `KIT_INSERT_KINDS` (a `Set`) and
`KitInsertShape` (a type) are the same list on adjacent lines with zero linkage
(`actions/defaults/insert.ts:70`, `:74`); `invoker.ts:258` is a third spelling. Only two of
the nine are parity-gated. Add a kind and the live preview silently vanishes.
**Verdict: COLLAPSE** onto one `as const` descriptor table.

Also drifted, same shape: two `Stroke`→SVG serializers in one file disagreeing on
zero-width and the opacity model (`svg/serialize.ts:265` vs `:290`); `GradientUnits`
export is 4→2 and import 2→2, so `local` silently becomes `world` and a gradient on a
grouped shape shifts by the group transform; `RenderLayer.space` re-implemented at
`useDispatcherOverlayLayer.ts:305` against a docstring at `core/layers/render.ts:196`
warning verbatim against a second copy.

## Tier 3 — closure-over-surface, live now that N views exist

Each of these paints or answers for view zero in every view, because `<CanvasView>` draws
the surface's layer array unchanged and only the envelope differs. A `draw: (_data, …)` is
therefore a guarantee of answering for the wrong view, not merely an unused argument.

`usePreviewGhostLayer.ts:80` (a drag in view B ghosts in view A) · `useDispatcherOverlayLayer.ts:80`
(marquee paints in the wrong view; reads `isVisible` off the envelope but the dispatcher
from a closure) · `pathEditingOverlayLayer.ts:114` · `slopsDebugLayer.ts:53` (a debug
overlay that lies about hit regions) · chrome-caps `RuleCtx` (`SceneCanvas.tsx:1592` —
rules are correctly surface-wide, the **ctx** is not, and the same ctx gates dispatcher
eligibility for keyboard dispatch) · pointer world coords (`PointerProviderIfRoot.tsx:44`,
which paste-at-pointer reads) · `deps/ingestion.ts:30` (every Cmd+V centers on the wrong
camera) · pick tolerance (`SceneCanvas.tsx:1201`) · `deps/dispatcher.ts:19` (Escape in view
B cancels view A).

**Verdict: COLLAPSE** — publish `getPreviewIds` and the overlay/dispatcher reads on the
view helpers, give `RuleCtx` a per-view construction, and route the rest through
`viewRegistry.resolver.at`, which the virtual-viewports spec already establishes as the
one resolver per surface.

All eleven `exhaustive-deps` suppressions were checked and **none is stale in time** —
each bottoms out in a ref reassigned every render, with a version key as the deliberate
invalidation signal. Three carry dead deps worth a tidy: `useHandTool.ts:81` (`inertia`,
`axis`, `tracker`, `decay` — all four unread, which is the same inert-options bug
`docs/TODO.md` already records), `useSelectTool.ts:522` (`options.debug`) and
`useRotateTool.ts:160` (`handleHitRadius`, `rotationHandleDistance` — the dead thread from
L3). The staleness those sites do have is surface-vs-view, which no dep array can catch.

## Tier 4 — the pick/paint walks

Four hit-test walks, each fixing what the others miss. `useSelectTool.ts:169` is
clip-chain aware and override-aware but has an unrotated pre-filter, no hidden-layer
filter, and AABB leaf picking. `useSceneSelectTool.ts:222` — the one SceneCanvas installs —
is layer-major, rotation-correct, hidden-aware and silhouette-on, with **no clip term** and
raw `n.pose`. `sceneAdapter.ts:446`'s `walkClipAware` honors clips and is orphaned because
the actions route through `deps/`. `deps/hitTestArea.ts:76` is the live marquee and has an
unrotated fast-reject, verified numerically: a 100×20 rect at 45° spans y −32…52, and a
marquee at y −40…−25 is rejected before the correct silhouette test runs.

Consequences: a child clipped out of view by its container is invisible and still
clickable and marquee-selectable; a rubber-band over a rotated shape's protruding corner
selects nothing while a click on the same pixel selects it; click-picking and marquee
disagree about hidden layers *within one file*.

**Verdict: COLLAPSE onto one walk** — B's ordering, rotation and visibility plus A's clip
chain and `adapter.getPose`.

Same axis, three more. **Stroke reach**: `NodeShape.ts:486` `inkReach` handles align
correctly and is defeated by a pre-filter using `tolerance` alone (half a thick outer
stroke's ink is unclickable) and by `ShapeCoversPointOptions.scale` never being passed, so
`{px}` widths resolve as world units — while the caller computes `meanScale(view.scale)`
one line above. **Text**: three computations of one quantity — the paint cache
(`draw.ts:1282`), an uncached `layoutRuns` for the silhouette that *cannot* hit that cache
(keys on array identity), and a Canvas2D `measureText` caret path with no kerning
(`features/text/hitTest.ts:60`) that is currently masked only because it calls
`getContext('2d')` on a WebGL canvas and gets `null`. **Alpha and `layerOrder`** are paint
inputs that no hit path reads — a node faded to alpha 0 is invisible and fully clickable,
and a layer omitted from `layerOrder` is undrawn yet still claims clicks.

## What this audit falsified

Correct these in `docs/TODO.md` regardless of what gets fixed.

- **The pinch-zoom suspect is stale.** The double-apply is already fixed —
  `SceneCanvas.tsx:1930` deliberately omits `viewport` from its `<Canvas>`, per
  `.changeset/mac-trackpad-pinch-zoom.md`. It is one flag, not two, and the paths are no
  longer co-reachable. What remains is that `usePinchZoomTool` is dead-but-exported
  surface, and that zoom clamps are declared seven times in two disagreeing families
  (`0.1/8` in `zoomAt` and three re-declarations; `0.1/10` in `fitViewToBounds`,
  `wheelHandler`, `useZoom`) — so fit-to-bounds can produce 10× and the next pinch frame
  clamps it to 8×. Wheel behavior is answered three times with **inverted modifier
  meanings**, all three public.
- **The `previewIdsExtra`/`previewPoseExtra` suspect is refuted** as a priority-order
  defect: both ends walk tools→handles in the same order, and the one asymmetry is
  deliberate and documented at both ends. The real defects on that axis are L2, L7 and the
  preview-rotation pair (`useViewHelpers.ts:163` attaches rotation, `:206` forty lines
  below does not — held together only because `RECT_POSE_DESCRIPTOR.getBounds` is identity).
- **`SPEC_KIND_TO_GESTURE` is the smaller instance**, not the seed worth leading with. H2
  is the same shape with far larger blast radius.

## Deliberately not collapsed

Local- vs world-space bounds, and `nodeAtPoint` vs `pickBest`, are different questions.
Miter apex vs capsule and butt cap vs half-disc are a defensible hit model over shared
base geometry. `features/groups/unionBounds` stays rotation-free for commit-time actions
once the chrome path stops using it. SVG's `#000000` initial fill is a spec default, not
drift. `resolveNodeFill`'s split between `kit:path` and `kit:shape` is documented and
correct. Stroke align, clip and text layout genuinely cannot round-trip through SVG 1.1 —
but the exporter must say so out loud, which today it does not.

## Adjacent, not this pattern

Found while auditing, worth their own entries: `selectAll` has no visibility filter, so
Cmd+A then Delete removes nodes the user cannot see; SVG export ignores `layer.visible`
while pixel export honors it; `LayerRecord.locked` is written in five places and read by
nothing; user layers lose their `name` through `toJSON`; `<image>` flip and source-rect
never serialize; `packages/{svg,hud,ui,labkit,modes,d3,paint}` never import `geom` at all,
and three incompatible matrix-singularity policies coexist.
