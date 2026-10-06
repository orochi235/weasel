# Labkit — Agent Guide

A map of the library so agents can find what they need quickly.

## Where to find things

### Shell and primitives

| Concept | Source |
|---|---|
| `<LabShell>` | `src/lab/LabShell.tsx` |
| `<Workspace>` | `src/lab/Workspace.tsx` |
| `<Lightbox>`, `useLightbox`, `useLightboxControl`, `<LightboxLayers>` | `src/lightbox/` |
| The lab body and its shared surface's layers | `src/lab/LabSurface.tsx` |
| `<Toolbar>` + subcomponents | `src/primitives/Toolbar.tsx` |
| `<StatusBar>`, `<StatusBarItem>`, `<StatusBarSpacer>` | `@weasel-js/ui`, re-exported from `src/primitives/index.ts` |
| `<FpsMeter>` | `src/primitives/FpsMeter.tsx` |
| `<ScaleIndicator>` | `src/primitives/ScaleIndicator.tsx` |
| `<Legend>` | `src/primitives/Legend.tsx` |
| `<FloatingPanel>` | `src/primitives/FloatingPanel.tsx` |
| Element defaults, in `:where()` | `src/theme/base.less` |
| The `interstellar` theme value | `src/theme/interstellar.ts` |
| Class-prefix enforcement | `scripts/check-class-prefix.ts` |

### State runtime

| Concept | Source |
|---|---|
| Zustand store factory | `src/state/store.ts` |
| Storage adapters (IndexedDB, local, session, URL hash, memory, none) | `src/state/adapters.ts` |
| Record cache: debounced writes, other writers, conflicts | `src/state/records.ts` |
| Record names, and a document split into records | `src/state/labRecords.ts` |
| Opening a stored lab; store ↔ records binding | `src/state/openLabStore.ts` |
| `usePersistedState`, `<Persistence>` | `src/state/usePersistedState.ts`, `src/state/Persistence.tsx` |
| State / trial types | `src/state/types.ts` |
| Store + trial-id React contexts | `src/state/context.tsx` |
| Versioned lab document + migrations | `src/state/document.ts` |

### Instruments and config

| Concept | Source |
|---|---|
| `defineInstrument()` | `src/instrument/defineInstrument.ts` |
| Capability types (`Instrument`, `RenderContext`, ...) | `src/instrument/types.ts` |
| Config builder (`f.schema`, `f.number`, ...) | `src/config/builder.ts` |
| Rule chain + labkit's own inference | `src/config/rules.ts` |
| Schema -> weasel-ui `PrefGroup` | `src/config/resolve.ts` |
| Config paths (read, write, fill defaults) | `src/config/path.ts` |
| Legacy `ConfigField[]` adapter | `src/config/fromConfigField.ts` |
| Config schema validator | `src/instrument/validateConfigSchema.ts` |
| Config field types (`ConfigField`, deprecated) | `src/controls/types.ts` |
| `<ControlPanel>` (renders a resolved schema) | `src/controls/ControlPanel.tsx` |

### Lab / trial runtime

| Concept | Source |
|---|---|
| `<Lab>` (top-level entry) | `src/lab/Lab.tsx` |
| `LabContext` (instrument/trial ops) | `src/lab/LabContext.ts` |
| `<Trial>` | `src/trial/Trial.tsx` |
| `<TrialChrome>` (toolbar + sidebar + statusbar slots) | `src/trial/TrialChrome.tsx` |
| Trial title bar, undocked sections | `src/trial/TrialTitleBar.tsx`, `src/trial/UndockedSections.tsx` |
| Trial ops (add/clone/close/reset) | `src/trial/trialOps.ts` |

### Capabilities

| Concept | Source |
|---|---|
| `<CanvasStack>` (layered canvases + pan/zoom) | `src/canvas/CanvasStack.tsx` |
| `useLayerScheduler` (DPR-aware rAF dirty-flag scheduler) | `src/canvas/useLayerScheduler.ts` |
| Pan, zoom and tap on a trial canvas (weasel's dispatcher) | `src/canvas/CameraInput.tsx` |
| `screenToWorld` / `worldToScreen` | `src/canvas/canvasCoords.ts` |
| `<LayerList>` (reorder, visibility, nesting, cards) | `@weasel-js/ui` (re-exported by labkit) |
| Trial state undo (a weasel-history `History` on `TrialRecord.history`, entries from `stateOp`) | `src/trial/Trial.tsx`, `src/undo/stateOp.ts` |
| Synchronous event bus | `src/undo/eventBus.ts` |
| Trial clock, its registry, the lab's frame loop, `useTrialClock` / `useClockFrame` | `src/clock/` |
| `<Palette>` (drag source) | `src/dragdrop/Palette.tsx` |
| `<DragGhost>` (portal-rendered floater) | `src/dragdrop/DragGhost.tsx` |
| `useDragDrop` + `<DragOverlay>` (drop pipeline) | `src/dragdrop/DragDropRuntime.tsx` |

### Chrome regions

| Concept | Source |
|---|---|
| Region components (`titlebar`/`toolbar`/`palette`/`sidebar`/`viewport`/`status`) | `src/chrome/regions/` |
| Contribution + chrome-context types | `src/chrome/types.ts` |
| Built-in contributions (undo, zoom, export, marks, settings, …) | `src/chrome/builtins.tsx` |
| Merge + `suppress` | `src/chrome/merge.ts` |
| Undocked-panel state (tear a sidebar section into the workspace) | `src/state/undock.ts` |
| Undocked-panel hosts in the grid | `src/lab/panelHost.ts`, `src/lab/Workspace.tsx` |

### Annotations

| Concept | Source |
|---|---|
| Capability, target, store and API types | `src/annotations/types.ts` |
| `createAnnotationStore` (scene-backed, one scene per target) | `src/annotations/store.ts` |
| `useAnnotations` / `useAnnotationsOptional` | `src/annotations/AnnotationsContext.ts` |
| `<AnnotationOverlay>` (weasel tools + selection over a target) | `src/annotations/AnnotationOverlay.tsx` |
| `<AnnotationTargets>` (mounts one overlay per declared target) | `src/annotations/AnnotationTargets.tsx` |
| Tool palette and weasel-tool mapping | `src/annotations/toolMap.ts` |
| Fraction <-> world conversion | `src/annotations/frac.ts`, `src/annotations/view.ts` |
| Staleness against `positionDependsOn` | `src/annotations/staleness.ts` |
| Undo, routed to weasel history | `src/annotations/history.ts` |
| Draw commands, style resolution, SVG nodes | `src/annotations/paint.ts`, `drawOne.ts`, `svgNodes.ts` |
| Export (`capture`, `capturePlan`, SVG composition) | `src/annotations/capture.ts` |
| `<MarkList>` sidebar panel, `<ExportMenu>` | `src/annotations/MarkList.tsx`, `ExportMenu.tsx` |

## Capability quick reference

An instrument may declare any of these on its `defineInstrument({...})` spec:

| Capability | Adds | Trial effect |
|---|---|---|
| `canvas` | Layered `<canvas>` stack with pan/zoom | Replaces `render(ctx)` body |
| `layers` | Layer toggle/reorder UI | Adds `<LayerList>` to sidebar |
| `dragDrop` | Palette + drop pipeline | Adds `<Palette>` to sidebar; pointer drag emits `canvas.itemAdded` |
| `annotations` | Marks drawn over named regions | Adds the annotation tool palette, an overlay per target, a `Marks` sidebar panel, an `Export` toolbar button, and undo/redo |
| `tools` | Instrument-owned tools | Adds a palette region and a trial tool slot |
| `job` | Async work with progress | Starts on mount, aborts on unmount and key change; renders progress and cancel into the chrome |
| `undo` | Undo/redo bindings | Wires toolbar buttons; snapshots `state` on `snapshotOn` events |
| `clock` | Playback time | Gives the trial a `TrialClock` on `ctx.trial.clock`; `timed` layers repaint as it moves |

Capabilities compose: an instrument with `canvas` + `dragDrop` + `undo` gets all three behaviors automatically. See `src/trial/Trial.tsx` for the wiring.

## The trial clock

A trial whose instrument declares `clock` owns its playback time: a position,
`elapsed` (ms, counted across passes), moved by a signed `rate` — 0 pauses, a
negative rate plays backward. `pass` and `phase` (0–1 through the pass) derive
from it; `elapsed` itself never wraps. It opens paused (`rate: 0`) and plays
once (`loop: false`) unless declared otherwise.

- **Read it** three ways: a canvas layer marked `timed` gets `elapsed`, `pass`
  and `phase` in its draw args and repaints every frame the clock moves; an
  imperative renderer, or text that changes per frame, uses `useClockFrame`;
  anything that controls time uses `useTrialClock()`, which re-renders on rate,
  seek and loop changes only.
- **Reach it from chrome** with `useTrialClock(trialId?)`: that trial's, else
  the one rendered inside, else the lab's focused trial's.
- **One frame loop per lab** (`useClockLoop`, behind `useVisibleRaf`) syncs
  every clock that is not inert and sleeps when all are. A clock woken from
  inert only records the time on its first sync, so a pause never arrives as
  one long step.
- **`seekable: false`** is for an instrument whose state is built up by
  running: `seek` throws, and so does a negative rate. Reset still returns it
  to 0. Making such an instrument seekable is blits' job, from a history the
  client supplies — not a labkit checkpoint-and-replay. Scrubbing never
  discards a recorded future.
- **Named after blits** (`elapsed`, `rate`, `ramp`, `seek`, `sync`, `rebase`,
  `inert`, `onWake`), which is meant to replace weasel's animation engine: in
  its terms a trial clock is an owner whose voices play under it. Keep new
  members in that vocabulary.
- **Persistence**: `TrialRecord.clock` holds `{ elapsed, rate }`, written on
  rate, seek and loop changes, never per frame.

## When to use what

- One-off lab page with custom rendering? Import primitives directly from `@weasel-js/labkit`.
- Building an instrument? `defineInstrument({...})` and pass it to `<Lab instruments={[...]} />`.
- Adding a new layer type to canvas? Push a `CanvasLayer` into `instrument.canvas.layers`. See `src/canvas/AGENTS.md`.
- Adding undoable actions beyond state changes? Call `ctx.emit('myEvent')` and list `'myEvent'` in `instrument.undo.snapshotOn`.
- Letting users draw on the instrument? Declare `annotations.targets`; read the marks with `useAnnotations()`. See `docs/RECIPES.md`.
- Magnifying an instrument? Mount `<TrialLoupe>` from `@weasel-js/labkit/loupe` in its content — the canvas `render`, a stage's `overlay`, or around DOM content. See `src/loupe/AGENTS.md`.
- Adding a button or a panel to the trial? A `TrialContribution` on `instrument.chrome` or `<Lab chrome>` — not a fork of the region components.

### Property UI

| Concept | Source |
|---|---|
| `<PropertyGroup>` (subpanel grouping with `hidden`) | `@weasel-js/ui` (re-exported by labkit) |
| `<CurveField>` (1D y=f(x) curve editor) | `@weasel-js/ui` (re-exported by labkit) |
| `<SingletonExperimentProvider>` (one-trial state runtime) | `src/state/SingletonExperiment.tsx` |
| Weasel-ui passthroughs (`CurveEditor`, `useReorderDragList`, `formatNumber`, …) | `src/passthrough/weasel-ui.ts` (exported as `@weasel-js/labkit/weasel-ui`) |

## Conventions

- All DOM classes start with `lk-` (enforced by `scripts/check-class-prefix.ts`)
- Component CSS lives in a sibling `.less` file (e.g., `Toolbar.less` next to `Toolbar.tsx`)
- Each primitive ships with a `.test.tsx` and a `.stories.tsx`
- Design tokens are `--wzl-*` custom properties, from `@weasel-js/theme`; use them in component CSS, never hardcode colors. No `--lk-*` custom property is ever declared, so `var(--lk-…)` silently takes its fallback
- Capability types live in `src/instrument/types.ts`; do not redefine them in capability-specific modules

## Forking a primitive

If a primitive doesn't fit your needs, copy its source into your project. Each component is self-contained — TSX + LESS, no cross-imports beyond theme tokens.

## See also

- `docs/RECIPES.md` — composition patterns
- `src/canvas/AGENTS.md` — canvas internals
- `src/layers/AGENTS.md` — layer list internals
- `docs/superpowers/specs/2026-04-26-labkit-design.md` — full design spec
- `../../../docs/superpowers/specs/2026-09-02-labkit-annotations-design.md` — the annotations design, in the weasel repo root
