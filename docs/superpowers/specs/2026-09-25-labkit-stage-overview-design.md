# Contributions as the feature unit, and an overview built on them

> **Status: unbuilt.** Scaffolding for the `labkit-overview` branch. Arc 1 is
> specified in full, and arcs 2 and 3 in outline, each to be detailed before
> it starts. Delete this file when the last arc merges; fold anything durable
> into `docs/extending.md` and `docs/taxonomy.md` first.

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

## Arc 1 — engine

### 1.1 `Contribution` carries a whole feature

Routing keeps its kernel-agnostic `Contribution<TOverlay>`
(`routing/src/contributions/types.ts`) and gains one role:

```ts
interface ContributionRouting {
  // existing: id, eligibility, bindings, actions
  /** Dep sources this entry provides while it is installed, by dep name. */
  deps?: { [K in DepName]?: () => DepSchema[K] };
}
```

Core binds the kernel roles in a `SurfaceContribution`:

```ts
interface SurfaceContribution extends Contribution<RenderLayer<unknown>> {
  /** Views this entry adds to the surface, as `<SceneCanvas views>` takes. */
  views?: CanvasViewDescriptor[];
  /** Runs once the surface mounts; returns its teardown. For what the roles
   *  above cannot say: a registered (hit-testable) layer, a subscription. */
  attach?: (api: CanvasExtensionApi) => () => void;
}
```

`<SceneCanvas ambient>` accepts `SurfaceContribution`s. Installing one installs
every role, and removing it removes them. `mergeContributions` merges the new
roles too, and throws on a duplicate view id or dep name as it already does on
a duplicate entry id. The HUD moves onto `attach` and installs in one step.

### 1.2 Bindings and layers can be scoped to a view

- `BindingOpts.views?: readonly (string | null)[]`. The binding is live only
  for input the resolver assigns to one of these views, where `null` is the
  root. Omitted means every view, which is today's behavior.
- `RuleCtx.view` and `InvocationCtx.view`: the id of the view the input
  belongs to (`null` for the root). The dispatcher already knows it per view
  (`DispatcherViewTarget.id`).
- Layer draw data gains `viewId: string | null`. `<CanvasView>` sets it in the
  data it hands its layers (`CanvasView.tsx:364`), and the surface sets `null`.
  A contribution's `overlay` layers then paint in every view, as a view's
  `layers` default already includes them, and a layer can decline a view by
  its id.
- A new dep, `rootView`: the surface's own camera as a `ViewApi`, which views
  do not shadow. Inside a view, `view` answers that view's camera, as it does
  today. `rootView` is how an action bound in the minimap moves the main
  camera.

### 1.3 The pointer store knows its view

`PointerWorldPos` becomes `{ worldX, worldY, viewId: string | null } | null`.
`PointerContext` gains `get()`, `subscribe(fn)` and `getVersion()`, and
`usePointerPosition()` wraps them in `useSyncExternalStore`. The publisher
already resolves the target, so it now keeps `target.id`. One
`<PointerContextProvider>` can span several surfaces, since the root provider
defers to one already in scope, so a detached minimap and its main canvas share
a single pointer.

### 1.4 The minimap as a contribution

`createMinimapContribution(opts)` in `features/minimap/`:

| Role | What it holds |
|---|---|
| `views` | One `<CanvasView>` (`id: opts.id ?? 'minimap'`), `bounds: opts.rect`, `interactive: true`, with a `view` thunk from `computeFitView` over `opts.fit` |
| `actions` | `minimap.pan`: an ongoing drag that centers `rootView` on the pointer's world point on press and follows it while dragging. It carries today's `MinimapCanvas` math. |
| `bindings` | `{ kind: 'drag' } → minimap.pan`, with `views: [id]` |
| `overlay` | The visible-rect indicator (painted only when `viewId === id`), and the linked crosshair (painted in any view that isn't `pointer.viewId`) |
| `attach` | Subscribes to the pointer store, and requests a redraw while a crosshair is showing or has just hidden |

Consumers write `ambient={[createMinimapContribution({ rect, fit })]}`.

`<MinimapCanvas>` (the detached, separate-canvas case) keeps its props. Its
hand-rolled session is replaced by the same `minimap.pan` action on a
dispatcher of its own. It also publishes into, and draws its crosshair from,
the shared pointer store, so linked cursors work across two canvases.

The crosshair is a fixed screen size and takes its color from a theme token.
It hides when the pointer leaves every view.

### 1.5 Docs in the same arc

- `docs/extending.md` opens with the extension units (`Contribution` and its
  roles, `Tool`, `Action`, bindings, layers and registered layers, deps,
  views), what each carries, and how it installs, with the minimap as the
  worked example of a multi-role feature.
- `docs/taxonomy.md` §6 "Plugin (deferred)" is replaced by an entry saying
  `SurfaceContribution` is that unit. Its stale `docs/TODO.md:138` pointer
  goes with it.
- The `features/viewports` README's pointer to `<MinimapCanvas>` also mentions
  the contribution.

### 1.6 Testing

- Routing: a binding with `views` doesn't fire for input resolved to another
  view (extend `perViewRouting.test.tsx`), and `RuleCtx.view` reaches a rule.
- Core: installing and removing a contribution adds and removes its view, deps
  and attach teardown. `rootView` resolves to the root camera inside a view.
  The pointer store reports the view id, and subscribers fire on change only.
- Minimap: a drag in the minimap moves the root camera and leaves the
  minimap's alone. A drag on the root is unaffected. The indicator's rect math
  gets the existing `minimapMath` tests plus a view check.
- Pixels: `MinimapDemo` moves onto the contribution, gets a screenshot, and
  shows the crosshair in each direction.

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

- `viewport.dragPan` pans whichever view the drag lands in, because each view
  answers `view` with its own camera. An action that must move the main
  camera from inside a view reads `rootView`, never `view`.
- Registered layers paint above every view, and inside none of them
  (`Canvas.tsx:1382`). Chrome that has to appear inside a view is an `overlay`
  layer, never `attach` → `registerLayer`.
- jsdom can't see the fit, the indicator's placement or the crosshair.
  Assert camera writes, store values and paint-gating decisions; check the
  picture with a screenshot.
