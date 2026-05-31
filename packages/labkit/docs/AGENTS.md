# Labkit — Agent Guide

A map of the library so agents can find what they need quickly.

## Where to find things

### Plan 1 — Shell + primitives

| Concept | Source |
|---|---|
| `<LabShell>` | `src/lab/LabShell.tsx` |
| `<WorkspaceGrid>` | `src/lab/WorkspaceGrid.tsx` |
| `gridDims()` | `src/lab/gridDims.ts` |
| `<Toolbar>` + subcomponents | `src/primitives/Toolbar.tsx` |
| `<Sidebar>` | `src/primitives/Sidebar.tsx` |
| `<StatusBar>` | `src/primitives/StatusBar.tsx` |
| `<FpsMeter>` | `src/primitives/FpsMeter.tsx` |
| `<ScaleIndicator>` | `src/primitives/ScaleIndicator.tsx` |
| Theme tokens | `src/theme/tokens.less` |
| Theme overrides | `src/theme/light.less`, `src/theme/dark.less` |
| Class-prefix enforcement | `scripts/check-class-prefix.ts` |

### Plan 2 — State runtime

| Concept | Source |
|---|---|
| Zustand store factory | `src/state/store.ts` |
| Storage adapters (none/local) | `src/state/adapters.ts` |
| State / workspace types | `src/state/types.ts` |
| Store React context | `src/state/context.ts` |

### Plan 3 — Instruments

| Concept | Source |
|---|---|
| `defineInstrument()` | `src/instrument/defineInstrument.ts` |
| Capability types (`Instrument`, `RenderContext`, ...) | `src/instrument/types.ts` |
| Capability detector (booleans for each capability) | `src/instrument/capabilityDetector.ts` |
| Config schema validator | `src/instrument/validateConfigSchema.ts` |
| Config field types (`ConfigField`, ...) | `src/controls/types.ts` |
| `<ControlPanel>` (renders `configSchema`) | `src/controls/ControlPanel.tsx` |

### Plan 4 — Lab/Workspace runtime

| Concept | Source |
|---|---|
| `<Lab>` (top-level entry) | `src/lab/Lab.tsx` |
| `LabContext` (instrument/workspace ops) | `src/lab/LabContext.ts` |
| `<Workspace>` | `src/workspace/Workspace.tsx` |
| `<WorkspaceChrome>` (toolbar + sidebar + statusbar slots) | `src/workspace/WorkspaceChrome.tsx` |
| Default chrome slots | `src/workspace/DefaultToolbar.tsx`, `DefaultSidebar.tsx`, `DefaultStatusBar.tsx` |
| Workspace ops (add/clone/close/reset) | `src/workspace/workspaceOps.ts` |

### Plan 5 — Capabilities

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

## Capability quick reference

An instrument may declare any of these on its `defineInstrument({...})` spec:

| Capability | Adds | Workspace effect |
|---|---|---|
| `canvas` | Layered `<canvas>` stack with pan/zoom | Replaces `render(ctx)` body |
| `layers` | Layer toggle/reorder UI | Adds `<LayerList>` to sidebar |
| `dragDrop` | Palette + drop pipeline | Adds `<Palette>` to sidebar; pointer drag emits `canvas.itemAdded` |
| `undo` | Undo/redo bindings | Wires toolbar buttons; snapshots `state` on `snapshotOn` events |

Capabilities compose: an instrument with `canvas` + `dragDrop` + `undo` gets all three behaviors automatically. See `src/workspace/Workspace.tsx` for the wiring.

## When to use what

- One-off lab page with custom rendering? Import primitives directly from `@labkit/react`.
- Building an instrument? `defineInstrument({...})` and pass it to `<Lab instruments={[...]} />`.
- Adding a new layer type to canvas? Push a `CanvasLayer` into `instrument.canvas.layers`. See `src/canvas/AGENTS.md`.
- Adding undoable actions beyond state changes? Call `ctx.emit('myEvent')` and list `'myEvent'` in `instrument.undo.snapshotOn`.

### Plan 6 — Property UI extensions

| Concept | Source |
|---|---|
| `<PropertyGroup>` (subpanel grouping with `hidden`) | `src/ui/properties/PropertyGroup.tsx` |
| `<CurveField>` (1D y=f(x) curve editor) | `src/ui/properties/CurveField.tsx` |
| `<LayerStack>` (expandable layer cards w/ drop-hint reorder) | `src/ui/layers/LayerStack.tsx` |
| `<SingletonExperimentProvider>` (one-workspace state runtime) | `src/state/SingletonExperiment.tsx` |
| Weasel-ui passthroughs (`CurveEditor`, `useReorderDragList`, `formatNumber`, …) | `src/passthrough/weasel-ui.ts` (exported as `@labkit/react/weasel-ui`) |

## Conventions

- All DOM classes start with `lk-` (enforced by `scripts/check-class-prefix.ts`)
- Component CSS lives in a sibling `.less` file (e.g., `Toolbar.less` next to `Toolbar.tsx`)
- Each primitive ships with a `.test.tsx` and a `.stories.tsx`
- Theme tokens are CSS custom properties (`--lk-*`); use them in component CSS, never hardcode colors
- Capability types live in `src/instrument/types.ts`; do not redefine them in capability-specific modules

## Forking a primitive

If a primitive doesn't fit your needs, copy its source into your project. Each component is self-contained — TSX + LESS, no cross-imports beyond theme tokens.

## See also

- `docs/RECIPES.md` — composition patterns
- `src/canvas/AGENTS.md` — canvas internals
- `src/layers/AGENTS.md` — layer list internals
- `docs/superpowers/specs/2026-04-26-labkit-design.md` — full design spec
