# Contributions as the feature unit, and an overview built on them

> **Status: arc 1 built; arcs 2 and 3 unbuilt.** Scaffolding for the
> `labkit-overview` branch. Arcs 2 and 3 are in outline, each to be detailed
> before it starts. Delete this file when the last arc merges; fold anything
> durable into `docs/extending.md` and `docs/taxonomy.md` first.

For whoever builds any arc of this. It answers how a feature made of views,
layers, bindings and deps installs in one step, and how a minimap with linked
cursors is written as one such feature — first on a `<SceneCanvas>`, then
over a labkit trial.

## Why

levar's eye marks lab needs an overview of a stage with linked cursors, and
hand-rolls one (`visor/src/eyemarks/Context.tsx`, `GhostCursor.tsx`). Its eye
points are labkit annotation marks. Writing that as a one-off labkit component
would repeat what weasel already half-has, in a place that can't use it:

- `<SceneCanvas ambient>` takes a `Contribution`, the engine's unit for a
  feature that isn't a tool. It carries bindings, actions and overlay layers
  only, so a bigger feature installs in pieces. The HUD takes two steps
  (`ambient` plus `api.registerLayer`, `hud/src/attach.ts:171`), and a minimap
  would take three (`addView`, `useDepSource`).
- Core has `<CanvasView>` (a second camera on one surface, with input routed
  to it), `<MinimapCanvas>` and `computeFitView`. `MinimapCanvas` pans with a
  hand-rolled `openPointerSession`, outside the dispatcher.
- `PointerContext` publishes the pointer's world position. The resolver works
  out which view it's over (`PointerProviderIfRoot.tsx:46`), then drops the
  view id.
- labkit trial content (`CanvasStack`, `Stage`) pans and zooms through its own
  `usePanZoom`, and touches none of the above.

`docs/taxonomy.md` §6 lists the missing piece as a deferred `WeaselPlugin`.
This design builds it by growing `Contribution` rather than adding a parallel
type.

## Arc 1 — engine (built)

Built on this branch: `SurfaceContribution` (`views`, `attach`) and
`Contribution.deps`, view-scoped bindings (`opts.views`, `viewId` on invocation
and rule contexts and on layer data), the `rootView` and `pointer` deps, the
pointer store, and the minimap as a contribution
(`packages/core/src/features/minimap/`). `docs/extending.md` opens with the
unit map. Arcs 2 and 3 build on these names:

- `ctx.viewId` / `RuleCtx.viewId` / layer `data.viewId`, not `view` — `view` is
  a camera throughout weasel.
- `attach(api, deps)` reads deps through its second argument; the pointer store
  is the `pointer` dep.
- `minimapCenterAction()` / `minimapPanAction()` are exported on their own, for
  a host that binds them on a dispatcher of its own, as `<MinimapCanvas>` does.
- `createLinkedCursorLayer({ id, pointer, color, views })` is the crosshair.

## Arc 2 — labkit trials on the dispatcher, and the overview

### 2.1 The camera as a weasel `View`

labkit's camera is `{ zoom, pan }` in screen pixels, placed by a `WorldFrame`
(`originPx`, `yDir`). It maps exactly onto a weasel `View` over *frame-local*
coordinates — the instrument's world with `y` negated when its axis runs up:

| labkit | weasel |
|---|---|
| `zoom` | `scale.x = scale.y = zoom` |
| `pan`, `frame.originPx` | `x = -(originPx.x + pan.x) / zoom`, `y` likewise |

`canvas/cameraView.ts` holds the pair of conversions, and
`clampZoomAbout(prev, next, min, max)`, which clamps a zoom while keeping the
point the zoom was anchored on fixed. Core's viewport actions then drive a
labkit camera unchanged, and frame-local points convert to the instrument's
world by `y *= yDir`.

### 2.2 `useCameraInput` replaces `usePanZoom`

`canvas/useCameraInput.ts` mounts `useGestureDispatcher` on the host element
(`<CanvasStack>`'s container, `<Stage>`'s viewport) with:

| Deps | `view` and `rootView`: a `ViewApi` over the labkit camera, clamped to `minZoom`/`maxZoom` widened to keep the opening zoom reachable; `hostSize` from the host's rect |
|---|---|
| Actions | `viewport.dragPan`; `makeViewportZoomAction({ wheel: 'plain' })`; `trial.tap`, which calls `onTap(world)` |
| Bindings | `drag` → `viewport.dragPan`; `click` → `trial.tap` |

It uses the actions registry in scope, and mounts an isolated one
(`<WeaselProvider isolate>`) when there is none, so `<CanvasStack>` and
`<Stage>` keep working on their own. It also fills `CameraWheelContext` with a
forwarder that re-dispatches a wheel on the host. `CanvasStack.onHitTest`
becomes `trial.tap`. `usePanZoom` is deleted.

`<Trial>` wraps its body in one `<WeaselProvider isolate>`, so the camera, the
loupe and the overview share one actions registry, one dep registry and one
pointer store per trial.

**The loupe joins that dispatcher.** `loupe.magnify` takes `scope: 'hotkey'`,
so while the lens is up it outranks the camera's wheel zoom, and while it is
down it declines and the zoom runs. `<LoupeGestures>` registers its actions in
the scope it is in and mounts a dispatcher only when the host has none
(`HostDispatchContext`, set by `useCameraInput`), which is the DOM
`.lk-trial__loupe-host` case.

**Follow-up, filed in `docs/TODO.md`:** palette drag-drop (`useDragDrop`) is a
DOM drag from the sidebar onto the canvas, not a canvas gesture; it keeps its
own pointer session.

### 2.3 The trial's pointer

`useCameraInput` publishes the pointer into the store in scope as
`{ worldX, worldY, viewId: 'stage' }` in the instrument's world, and clears it
on leave. `RenderContext.trial.pointer` is that store
(`PointerContextValue`), so an instrument's keys read `get()` over the stage or
the overview alike.

### 2.4 The overview, at `@weasel-js/labkit/overview` (built)

`<TrialOverview width height render? bounds? title? anchor? persist?>`, its own
tsup entry and package export, not in the main bundle. An instrument mounts it
from `stage.overlay` (DOM stage) or its `render` (canvas) — anywhere inside the
camera, which it reads through `CameraContext` (set by `<CanvasStack>` and
`<Stage>`: the camera as a `ViewApi`, the frame, the element, a stage's content
rect). No labkit contribution list was needed.

It draws the instrument-supplied `render({ size })` scaled to fit, or a canvas
instrument's layers from `CanvasStackContext`; a 2D chrome canvas with the
visible rect and core's `crosshairRects`; and runs `minimapCenterAction` /
`minimapPanAction` on an isolated dispatcher with the trial camera as
`rootView`, publishing `viewId: 'overview'`. It stops its events at the box,
since it sits inside the stage's element. `<LinkedCursor>` draws the stage side.
`examples/annotate-lab` and a story show it.

### 2.5 Tests

- `cameraView`: round trip over both y axes and a moved origin; `clampZoomAbout`
  keeps the anchor.
- `useCameraInput`: drag pans by the screen delta, wheel zooms about the
  pointer within the clamp, tap reports the world point, the pointer store gets
  the world point with `viewId: 'stage'`.
- Existing `CanvasStack`, `Stage`, `Trial.canvas`, `Trial.loupe` tests keep
  passing; the loupe claims the wheel only while up.
- Overview: a press recenters the trial camera; the pointer over the overview
  publishes `viewId: 'overview'`; the crosshair paints when the pointer is on
  the stage. A labkit story shows it; a screenshot checks the picture.

## Arc 3 — marks on the overview

- **Store:** `AnnotationsApi.paintedMarks(target)` answers a target's marks as
  the pane paints them — `{ mark: PaintableMark, style: MarkStyle }[]` in
  scene order, styles resolved by `resolveMarkStyle` against the store's live
  `meaning` and `config`. `capture` and it share one `drawOptionsFor(target)`,
  so an export, the pane and the overview cannot disagree on a color or a
  stale dash.
- **Overview:** a marks layer in `<TrialOverview>`, drawn whenever an
  annotations store is in scope (`AnnotationsContext`). For each target it
  measures the target's element (`ref`, carried by the capability's targets)
  against the camera's element, converts that rect to frame-local units
  through the camera, and places one `<svg>` there through the fit camera —
  `markSvgNodes` → `serializeSvg`, the export's own vector path. Read-only: it
  takes no input, so presses fall through to the overview's pan. It follows the
  store's `subscribe`.
- **Tests:** `paintedMarks` resolves a status color and a stale dash; the
  overview places a target's marks at the target's measured rect (a mocked
  `getBoundingClientRect`), and redraws when a mark is added.
- **levar:** with this, the eye marks lab can drop `Context.tsx` and
  `GhostCursor.tsx`.

## Traps

- jsdom can't see the fit, the indicator's placement or the crosshair.
  Assert camera writes, store values and paint-gating decisions; check the
  picture with a screenshot.
