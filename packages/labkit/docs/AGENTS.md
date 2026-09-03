# Labkit — Agent Guide

A map of the library so agents can find what they need quickly.

## Where to find things

### Shell and primitives

| Concept | Source |
|---|---|
| `<LabShell>` | `src/lab/LabShell.tsx` |
| `<Workspace>` | `src/lab/Workspace.tsx` |
| `<Toolbar>` + subcomponents | `src/primitives/Toolbar.tsx` |
| `<Sidebar>` | `src/primitives/Sidebar.tsx` |
| `<StatusBar>` | `src/primitives/StatusBar.tsx` |
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
| Storage adapters (none/local) | `src/state/adapters.ts` |
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
| `usePanZoom` | `src/canvas/usePanZoom.ts` |
| `screenToWorld` / `worldToScreen` | `src/canvas/canvasCoords.ts` |
| `<LayerList>` (visibility toggles + reorder) | `src/layers/LayerList.tsx` |
| Undo stack (pure FIFO with `past`/`future`) | `src/undo/undoStack.ts` |
| Synchronous event bus | `src/undo/eventBus.ts` |
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
| `loupe` | Magnifier | Adds a `loupe` toolbar toggle; the lens re-draws the canvas layers at a zoomed camera, or calls the capability's own `render` for DOM content |
| `undo` | Undo/redo bindings | Wires toolbar buttons; snapshots `state` on `snapshotOn` events |

Capabilities compose: an instrument with `canvas` + `dragDrop` + `undo` gets all three behaviors automatically. See `src/trial/Trial.tsx` for the wiring.

## When to use what

- One-off lab page with custom rendering? Import primitives directly from `@weasel-js/labkit`.
- Building an instrument? `defineInstrument({...})` and pass it to `<Lab instruments={[...]} />`.
- Adding a new layer type to canvas? Push a `CanvasLayer` into `instrument.canvas.layers`. See `src/canvas/AGENTS.md`.
- Adding undoable actions beyond state changes? Call `ctx.emit('myEvent')` and list `'myEvent'` in `instrument.undo.snapshotOn`.
- Letting users draw on the instrument? Declare `annotations.targets`; read the marks with `useAnnotations()`. See `docs/RECIPES.md`.
- Adding a button or a panel to the trial? A `TrialContribution` on `instrument.chrome` or `<Lab chrome>` — not a fork of the region components.

### Property UI

| Concept | Source |
|---|---|
| `<PropertyGroup>` (subpanel grouping with `hidden`) | `@weasel-js/ui` (re-exported by labkit) |
| `<CurveField>` (1D y=f(x) curve editor) | `@weasel-js/ui` (re-exported by labkit) |
| `<LayerStack>` (expandable layer cards w/ drop-hint reorder) | `@weasel-js/ui` (re-exported by labkit) |
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
