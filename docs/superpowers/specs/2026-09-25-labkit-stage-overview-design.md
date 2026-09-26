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

## Arc 2 — labkit trials on the dispatcher, and the overview (outline)

- `Trial` hosts a weasel dispatcher over its content host, as
  `examples/3d-lab/SolidInstrument.tsx` does per instrument. Pan and zoom
  become the core viewport actions bound on it, and `usePanZoom` retires. The
  canvas instruments' `onHitTest` and drag-drop move onto actions at the same
  time or are listed as follow-ups. Detail them before starting.
- The trial's pointer is published into a `PointerContextProvider`, with view
  ids `stage` and `overview`. `RenderContext.trial.pointer` exposes it to
  instruments, so levar's keys read `get()` in content coordinates over either
  view.
- The overview is a detached panel (a `FloatingPanel`) at
  `@weasel-js/labkit/overview`, outside the main bundle. It draws:
  - its content: a canvas instrument's layers redrawn through the fit camera;
    for a DOM stage, an instrument-supplied `render`, as the DOM loupe does,
    because re-running the instrument's own `render` would run its effects
    twice;
  - the same `minimap.pan` action and linked crosshair as arc 1;
  - the indicator.
- An instrument declares it with the trial's existing chrome and overlay seams.
  Whether that needs a labkit-side contribution list is decided in this arc's
  detail, not here.

## Arc 3 — marks on the overview (outline)

The annotation marks of every target drawn read-only on the overview, from
`markCommands` (the painter the export already uses). Each target is placed by
measuring its `ref` against the content element. This needs one addition to
the annotations store: a selector for a target's marks with resolved styles,
readable outside `AnnotationOverlay`. levar can delete `Context.tsx` and
`GhostCursor.tsx` when this lands.

## Traps

- jsdom can't see the fit, the indicator's placement or the crosshair.
  Assert camera writes, store values and paint-gating decisions; check the
  picture with a screenshot.
