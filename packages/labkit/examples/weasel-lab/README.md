# weasel-lab

Proof-of-concept: labkit's Lab/Workspace chrome wrapping a weasel scene-graph canvas.

## Run

```bash
npm run dev:weasel
```

## What this demonstrates

- A labkit `<Lab>` shell (toolbar with Save/Clone/Reset/Close, sidebar with control panel, status bar, multi-workspace tabs) wrapping a `<SceneCanvas>` from `@orochi235/weasel`.
- The instrument declares no `canvas`/`dragDrop`/`undo` capability — weasel owns all canvas, gesture, and history concerns.
- Config schema (`Show grid`, `Grid spacing`) flows from labkit's `defineInstrument` into the scene's grid layer.
- `LABKIT_EXAMPLE=weasel-lab` triggers a different alias set in `vite.config.ts` that replicates weasel's internal monorepo aliases (so `@orochi235/weasel-history`'s bare `core/...` imports resolve against the weasel checkout).

## Layout note

The host div uses `position: relative; overflow: hidden` and the SceneCanvas wrapper inside is `position: absolute; inset: 0`. This is **load-bearing**: SceneCanvas sizes its `<canvas>` via the `width`/`height` props, and ResizeObserver-based auto-sizing on a flow-layout container creates a feedback loop where the canvas's intrinsic dimensions grow the parent, which fires the observer, which resizes the canvas, ad infinitum (~80 React renders/sec). The absolute child decouples canvas growth from parent layout.

## Bridged behaviors

- **Persistence:** the instrument hydrates the weasel scene from labkit state on mount (via `sceneFromJSON`), subscribes to scene mutations, and pushes `scene.toJSON()` back into labkit state. A `lastPushedRef` distinguishes self-pushes (no rebuild) from external state changes (Reset, Clone, Undo, Redo) so the underlying weasel `Scene` gets swapped via `buildScene()` when needed. The `Lab` is configured with `localStorageAdapter`, so the round-trip survives reloads.
- **Reset / Clone:** work via the persistence bridge above. Reset clears `state.scene` → instrument rebuilds with `INITIAL_NODES`. Clone produces a new workspace whose initial state is a deep copy of the source — its scene hydrates from that copy on first mount.
- **Undo / Redo:** the instrument declares `undo: { snapshotOn: ['state.change'] }`. Since every scene mutation flows through `ctx.setState`, labkit's snapshot-based undo machinery captures the full serialized scene on each step. Undo restores prior state.scene → the external-change detector rebuilds the weasel scene from that JSON. (This required fixing a latent labkit redo bug — `undo()`/`redo()` now take the current state so the abandoned side gets pushed onto the opposite queue.)

## Why this matters

This is the "shape 1" integration from the design discussion — coexistence as an example, no kit changes. If the bridge fills out cleanly (persistence + history wiring), the case for a first-class `scene` capability that replaces `canvas`/`dragDrop`/`undo` for editor-style labs gets a lot stronger.
