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

## Known gaps

- **Scene rectangles do not paint yet.** The GL context initialises, weasel's SceneCanvas mounts, but the three demo rects in `SceneInstrument.tsx` come up blank. Likely a missing piece in the SceneCanvas setup (font registration, viewport auto-center, or selection context mount order) — needs a side-by-side comparison against `~/src/weasel/demo/demos/MoveDemo.tsx` running inside the weasel demo.
- **Persistence does not bridge.** Labkit's "Save / Reset / Clone" operates on labkit's own state — weasel owns the scene via `useScene`, so cloning a workspace gets a labkit clone but a fresh weasel scene.
- **Undo/Redo are not wired.** Labkit's toolbar Undo/Redo buttons don't appear because the instrument doesn't declare `undo`. Weasel has its own op-based history (`createHistory`) — the next step is a bridge capability that surfaces weasel actions in labkit's toolbar.

## Why this matters

This is the "shape 1" integration from the design discussion — coexistence as an example, no kit changes. If the bridge fills out cleanly (persistence + history wiring), the case for a first-class `scene` capability that replaces `canvas`/`dragDrop`/`undo` for editor-style labs gets a lot stronger.
